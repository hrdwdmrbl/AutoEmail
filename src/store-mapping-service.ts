import { EmailMessage, ShopifyShop } from "./types";
import { DbService } from "./db-service";
import { AiService } from "./ai-service";
const levenshtein = require("fast-levenshtein");

export class StoreMappingService {
  private dbService: DbService;
  private aiService: AiService;
  private domainBlocklist = new Set([
    "aol.com",
    "gmail.com",
    "gmx.com",
    "hotmail.com",
    "icloud.com",
    "live.com",
    "mac.com",
    "mail.com",
    "me.com",
    "msn.com",
    "outlook.com",
    "protonmail.com",
    "yahoo.com",
    "yandex.com",
    "zoho.com",
    "shopify.com",
  ]);

  constructor(dbService: DbService, aiService: AiService) {
    this.dbService = dbService;
    this.aiService = aiService;
  }

  private shopify_shops: ShopifyShop[] = [];
  public async loadStores(): Promise<void> {
    this.shopify_shops = await this.dbService.executeQuery<ShopifyShop>("getAllStores");
  }

  public isReady(): boolean {
    return this.shopify_shops.length > 0;
  }

  /**
   * Given an email, attempt to map it to a store in our database
   */
  async mapEmailToStore(email: EmailMessage): Promise<ShopifyShop | null> {
    // Try a series of methods in order of reliability
    let shopifyShop: ShopifyShop | null = null;

    // Method 1: Try to find by exact email address
    shopifyShop = this.findStoreByExactEmail(email.from.address);
    if (shopifyShop) return shopifyShop;

    // Method 2: Try to find by domain (if it's not a common email provider)
    shopifyShop = this.findStoreByDomain(email.from.address);
    if (shopifyShop) return shopifyShop;

    // Method 3: Try to find by name (using fuzzy matching)
    if (email.from.name) {
      shopifyShop = this.findStoreByFuzzyName(email.from.name);
      if (shopifyShop) return shopifyShop;
    }

    // Method 4: Last resort, ask AI to try to match based on context
    shopifyShop = await this.findStoreByAI(email);

    return shopifyShop;
  }

  /**
   * Find a store by exact email match
   */
  private findStoreByExactEmail(emailAddress: string): ShopifyShop | null {
    return (
      this.shopify_shops.find((shop) => shop.email === emailAddress) ||
      this.shopify_shops.find((shop) => shop.customer_email === emailAddress) ||
      null
    );
  }

  /**
   * Find a store by domain name
   */
  private findStoreByDomain(emailAddress: string): ShopifyShop | null {
    const domainMatch = emailAddress.match(/@([^@]+)$/);
    if (!domainMatch || !domainMatch[1]) return null;

    const domain = domainMatch[1].toLowerCase();

    if (this.domainBlocklist.has(domain)) return null;

    const results = this.shopify_shops.filter((shop) => shop.domain?.includes(domain));

    if (results.length > 1) {
      throw new Error(`Multiple stores found for domain ${domain}`);
    } else if (results.length === 1) {
      return results[0];
    } else {
      return null;
    }
  }

  /**
   * Find a store by fuzzy name matching
   */
  private findStoreByFuzzyName(name: string): ShopifyShop | null {
    const results = this.shopify_shops.sort((shop) => this.distanceRatio(shop.name, name));
    const bestMatch = results[0];
    const ratio = this.distanceRatio(bestMatch.name, name);
    if (ratio < 0.9) {
      return null;
    } else {
      return bestMatch;
    }
  }

  private distanceRatio(a: string, b: string): number {
    const total_length = a.length + b.length;
    if (total_length === 0) return 1.0;
    const distance = levenshtein.get(a, b);
    const ratio = (total_length - distance) / total_length;
    return ratio;
  }

  /**
   * Last resort: use AI to try to match the store based on email content
   */
  private async findStoreByAI(email: EmailMessage): Promise<ShopifyShop | null> {
    // Get list of all store names and domains for context
    const allStores = this.shopify_shops.map((shop) => ({
      id: shop.id.toString(),
      name: shop.name,
      email: shop.email,
      customer_email: shop.customer_email,
      shop_owner: shop.shop_owner,
      domain: shop.domain,
      shopify_domain: shop.shopify_domain,
    }));

    // Format the list of stores for the AI
    const storesList = allStores
      .map(
        (store) =>
          `ID: ${store.id}, Name: ${store.name}, Email: ${store.email}, Customer Email: ${store.customer_email}, Shop Owner: ${store.shop_owner}, Domain: ${store.domain}, Shopify Domain: ${store.shopify_domain}`
      )
      .join("\n");

    // Create prompt for AI
    const prompt = `
You are helping to match an email sender to one of our stores.
Email from: ${email.from.name} <${email.from.address}>
Email subject: ${email.subject}
Email snippet: ${email.text.substring(0, 200)}...

Here is the list of potential store matches:
${storesList}

Based on the email, which store (if any) do you think this is from? 
If you find a match, respond with ONLY the store ID.
If there's no CLEAR match, respond with "NO_MATCH".
`;

    const content = await this.aiService.promptWithRetry(prompt, "o4-mini");

    // If no match or invalid response
    if (content === "NO_MATCH") return null;

    // Get the store info by ID
    const storeId = content.replace(/[^a-zA-Z0-9_-]/g, ""); // Sanitize the ID
    return this.shopify_shops.find((shop) => shop.id.toString() === storeId) || null;
  }
}
