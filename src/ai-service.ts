import OpenAI from "openai";
import fs from "fs/promises";
import { EmailMessage, ShopifyShop } from "./types";
import { PriorityService } from "./priority-service";
import { StoreMappingService } from "./store-mapping-service";
import { StoreInfoService } from "./store-info-service";
import { DbService } from "./db-service";

export class AiService {
  private openai: OpenAI;
  private knowledgeFilePath: string;
  private knowledgeContent: string | null = null;
  private priorityService: PriorityService;
  private storeMappingService: StoreMappingService;
  private storeInfoService: StoreInfoService;

  constructor(apiKey: string, knowledgeFilePath: string, dbService: DbService) {
    this.openai = new OpenAI({ apiKey });
    this.knowledgeFilePath = knowledgeFilePath;
    this.priorityService = new PriorityService(apiKey, this);

    this.storeMappingService = new StoreMappingService(dbService, this);
    this.storeInfoService = new StoreInfoService(dbService);
  }

  async loadKnowledgeBase(): Promise<void> {
    try {
      this.knowledgeContent = await fs.readFile(this.knowledgeFilePath, "utf-8");
      // Share knowledge content with the priority service
      this.priorityService.setKnowledgeContent(this.knowledgeContent);
      console.log("✅ Knowledge base loaded successfully");
    } catch (error) {
      console.error("❌ Failed to load knowledge base:", error);
      throw new Error(`Failed to load knowledge base from ${this.knowledgeFilePath}`);
    }
  }

  async generateResponse(emails: EmailMessage[]): Promise<string> {
    if (!this.knowledgeContent) {
      await this.loadKnowledgeBase();
    }
    if (!this.storeMappingService.isReady()) {
      await this.storeMappingService.loadStores();
    }
    if (!this.storeInfoService.isReady()) {
      await this.storeInfoService.loadStoreInfo();
    }

    // Generate the response with store information if available
    const prompt = await this.createPrompt(emails);
    const content = await this.promptWithRetry(prompt, "gpt-4.1-2025-04-14");

    // Remove the urgency score marker from the response if it exists
    return content?.replace(/\[URGENCY_SCORE:\s*\d+\]\s*/g, "");
  }

  public async promptWithRetry(
    prompt: string,
    model: string = "gpt-4.1-2025-04-14",
    retriesRemaining: number = 3
  ): Promise<string> {
    if (retriesRemaining === 0) {
      throw new Error("Failed to generate AI response");
    }

    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages: [{ role: "system", content: prompt }],
      });

      return response.choices[0]?.message.content || "";
    } catch (error) {
      const err = error as Error;
      console.error("Error generating AI response:", err.message);
      if (err.message.includes("429")) {
        console.log("Rate limit exceeded, retrying...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.promptWithRetry(prompt, model, retriesRemaining - 1);
      }
      throw err;
    }
  }

  async scoreEmailUrgency(emails: EmailMessage[]): Promise<number> {
    return this.priorityService.scoreEmailUrgency(emails);
  }

  private async createPrompt(emails: EmailMessage[]): Promise<string> {
    // Get sender information from the first email
    const sender = emails[0].from;
    const senderInfo = `${sender.name ? sender.name + " " : ""}<${sender.address}>`;

    // For multiple emails, include all of them in the prompt
    const emailsContent = emails
      .map(
        (email, index) => `
## Email #${index + 1}:

Subject: ${email.subject}
Date: ${email.date.toISOString()}
Body:
${email.text}
`
      )
      .join("--------\n");

    // Try to fetch store information if services are available
    let storeInfoContent = "";
    const shopifyShop = await this.storeMappingService.mapEmailToStore(emails[0]);
    if (shopifyShop) {
      console.log(`✅ Found matching store: ${emails[0].from.address} -> ${shopifyShop.name}`);
      // Get additional store information
      const fullStoreInfo = this.storeInfoService.getStoreInfo(shopifyShop);
      storeInfoContent = `\n${JSON.stringify(fullStoreInfo)}\n`;
    } else {
      console.log(`❌ No matching store found for ${senderInfo}`);
    }

    return `
You are an email assistant responsible for drafting responses to incoming emails.
Use the knowledge base provided below to inform your responses.

# KNOWLEDGE BASE:

${this.knowledgeContent}${storeInfoContent}

------------

# Incoming emails:

${emails.length} email(s) from the sender
From: ${senderInfo}
Today's date: ${new Date().toISOString()}

${emailsContent}

------------

# Instructions:

Draft a ${
      emails.length > 1 ? "consolidated response to these emails" : "response to this email"
    } using the information from the knowledge base.

Your draft email will be reviewed by a human before being sent, so you can leave placeholders in the response for the agent to fill in.
Draft as much of the email as possible.
If you're unsure about the answer, you can even leave questions for the agent so that the knowledge base can be updated to help you in the future.

Make sure your response:
1. Addresses the sender's questions or concerns directly
2. Is formatted as plain text, ready to be sent as an email
3. DO NOT include the email subject in your response - it will be automatically shown in the email thread
4. ALWAYS sign the email as "Best regards,\\nMarc Beaupre" - do not use any other closing or signature
5. Always be improving. Ask questions for the agent if something leaves you unsure.
6. Don't say anything that you're unsure about - leave placeholders for the agent to fill in. It's worse to be too verbose than too short. Reviewing your drafts takes time, so be considerate of the agent's time.

YOUR RESPONSE:`;
  }
}
