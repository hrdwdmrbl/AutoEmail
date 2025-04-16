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

  async generateResponse(
    email: EmailMessage,
    scoreOnly: boolean = false
  ): Promise<{ response: string; urgencyScore: number }> {
    if (!this.knowledgeContent) {
      await this.loadKnowledgeBase();
    }

    // Get urgency score from priority service
    const urgencyScore = await this.priorityService.scoreEmailUrgency(email);

    // If we only need the score, return early
    if (scoreOnly) {
      return {
        response: "", // Empty response for score-only requests
        urgencyScore,
      };
    }

    // Otherwise generate the response
    const prompt = this.createPrompt(email);

    try {
      const response = await this.openai.chat.completions.create({
        model: "GPT-4.1",
        messages: [{ role: "system", content: prompt }],
      });

      const content =
        response.choices[0]?.message.content || "I apologize, but I was unable to generate a response at this time.";

      // Remove the urgency score marker from the response if it exists
      const cleanResponse = content.replace(/\[URGENCY_SCORE:\s*\d+\]\s*/g, "");

      return {
        response: cleanResponse,
        urgencyScore,
      };
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
5. Don't say anything that you're unsure about - leave placeholders for the agent to fill in. It's worse to be too verbose than too short. Reviewing your drafts takes time, so be considerate of the agent's time.
6. Always be improving. Leave notes for the agent to update the knowledge base to help you in the future.

YOUR RESPONSE:`;
  }
}
