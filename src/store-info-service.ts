import { DbService } from "./db-service";
import { ShopifyShop, StoreInfo, User } from "./types";

export class StoreInfoService {
  private dbService: DbService;

  constructor(dbService: DbService) {
    this.dbService = dbService;
  }

  public isReady(): boolean {
    return this.users.length > 0;
  }

  private users: User[] = [];
  public async loadStoreInfo(): Promise<void> {
    this.users = await this.dbService.executeQuery<User>("getAllUsers");
  }

  /**
   * Convert store info into a format suitable for the AI context
   */
  public getStoreInfo(shopifyShop: ShopifyShop): StoreInfo {
    const user = this.users.find((user) => user.id === shopifyShop.user_id);

    if (!user) {
      throw new Error(`User not found for shopify shop ${shopifyShop.name}, ${shopifyShop.user_id}`);
    }

    return {
      name: shopifyShop.name,
      domain: shopifyShop.domain,
      syncMode: user!.sync_level === 0 ? "Basic" : "Full",
      currency: shopifyShop.currency,
      company_name: user!.company_name,
      email: user!.email,
    };
  }
}
