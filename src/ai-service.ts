import OpenAI from "openai";
import fs from "fs/promises";
import { EmailMessage } from "./types";
import { PriorityService } from "./priority-service";

export class AiService {
  private openai: OpenAI;
  private knowledgeFilePath: string;
  private knowledgeContent: string | null = null;
  private priorityService: PriorityService;

  constructor(apiKey: string, knowledgeFilePath: string) {
    this.openai = new OpenAI({ apiKey });
    this.knowledgeFilePath = knowledgeFilePath;
    this.priorityService = new PriorityService(apiKey);
  }

  async loadKnowledgeBase(): Promise<void> {
    try {
      this.knowledgeContent = await fs.readFile(this.knowledgeFilePath, "utf-8");
      // Share knowledge content with the priority service
      this.priorityService.setKnowledgeContent(this.knowledgeContent);
      console.log("Knowledge base loaded successfully");
    } catch (error) {
      console.error("Failed to load knowledge base:", error);
      throw new Error(`Failed to load knowledge base from ${this.knowledgeFilePath}`);
    }
  }

  async generateResponse(emails: EmailMessage[]): Promise<string> {
    if (!this.knowledgeContent) {
      await this.loadKnowledgeBase();
    }

    // Otherwise generate the response
    const prompt = this.createPrompt(emails);

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4.1-2025-04-14",
        messages: [{ role: "system", content: prompt }],
      });

      const content =
        response.choices[0]?.message.content || "I apologize, but I was unable to generate a response at this time.";

      // Remove the urgency score marker from the response if it exists
      return content.replace(/\[URGENCY_SCORE:\s*\d+\]\s*/g, "");
    } catch (error) {
      console.error("Error generating AI response:", error);
      throw new Error("Failed to generate AI response");
    }
  }

  async scoreEmailUrgency(emails: EmailMessage[]): Promise<number> {
    if (!this.knowledgeContent) {
      await this.loadKnowledgeBase();
    }

    return this.priorityService.scoreEmailUrgency(emails);
  }

  private createPrompt(emails: EmailMessage[]): string {
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

    return `
You are an email assistant responsible for drafting responses to incoming emails.
Use the knowledge base provided below to inform your responses.

# KNOWLEDGE BASE:

${this.knowledgeContent}

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
