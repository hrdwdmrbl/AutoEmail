import OpenAI from "openai";
import fs from "fs/promises";
import { EmailMessage } from "./types";

export class AiService {
  private openai: OpenAI;
  private knowledgeFilePath: string;
  private knowledgeContent: string | null = null;

  constructor(apiKey: string, knowledgeFilePath: string) {
    this.openai = new OpenAI({ apiKey });
    this.knowledgeFilePath = knowledgeFilePath;
  }

  async loadKnowledgeBase(): Promise<void> {
    try {
      this.knowledgeContent = await fs.readFile(this.knowledgeFilePath, "utf-8");
      console.log("Knowledge base loaded successfully");
    } catch (error) {
      console.error("Failed to load knowledge base:", error);
      throw new Error(`Failed to load knowledge base from ${this.knowledgeFilePath}`);
    }
  }

  async generateResponse(email: EmailMessage): Promise<string> {
    if (!this.knowledgeContent) {
      await this.loadKnowledgeBase();
    }

    const prompt = this.createPrompt(email);

    try {
      const response = await this.openai.chat.completions.create({
        model: "o3-mini",
        messages: [{ role: "system", content: prompt }],
      });

      return (
        response.choices[0]?.message.content || "I apologize, but I was unable to generate a response at this time."
      );
    } catch (error) {
      console.error("Error generating AI response:", error);
      throw new Error("Failed to generate AI response");
    }
  }

  private createPrompt(email: EmailMessage): string {
    return `
You are an email assistant responsible for drafting responses to incoming emails.
Use the knowledge base provided below to inform your responses.

KNOWLEDGE BASE:
${this.knowledgeContent}

INCOMING EMAIL:
From: ${email.from.name ? email.from.name + " " : ""}<${email.from.address}>
Subject: ${email.subject}
Date: ${email.date.toISOString()}
Body:
${email.text}

Draft a response to this email using the information from the knowledge base.

Your draft email will be reviewed by a human before being sent, so you can leave placeholders in the response for the agent to fill in.
Draft as much of the email as possible.
If you're unsure about the answer, you can even leave questions for the agent so that the knowledge base can be updated to help you in the future.

Make sure your response:
1. Addresses the sender's questions or concerns directly
2. Is formatted as plain text, ready to be sent as an email
3. DO NOT include the email subject in your response - it will be automatically shown in the email thread
4. ALWAYS sign the email as "Best regards,\\nMarc Beaupre" - do not use any other closing or signature

YOUR RESPONSE:`;
  }
}
