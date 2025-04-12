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

  async generateResponse(
    email: EmailMessage,
    scoreOnly: boolean = false
  ): Promise<{ response: string; urgencyScore: number }> {
    if (!this.knowledgeContent) {
      await this.loadKnowledgeBase();
    }

    // Use different prompt if we only need the score
    const prompt = scoreOnly ? this.createScoringPrompt(email) : this.createPrompt(email);

    try {
      const response = await this.openai.chat.completions.create({
        model: "o3-mini",
        messages: [{ role: "system", content: prompt }],
      });

      const content =
        response.choices[0]?.message.content || "I apologize, but I was unable to generate a response at this time.";

      // Extract the urgency score (format expected: [URGENCY_SCORE: X])
      let urgencyScore = 50; // Default middle score
      const urgencyMatch = content.match(/\[URGENCY_SCORE:\s*(\d+)\]/);

      if (urgencyMatch && urgencyMatch[1]) {
        const parsedScore = parseInt(urgencyMatch[1], 10);
        // Ensure score is within 0-100 range
        urgencyScore = Math.min(100, Math.max(0, parsedScore));
      }

      // For score-only requests, we don't need to clean the response
      if (scoreOnly) {
        return {
          response: "", // Empty response for score-only requests
          urgencyScore,
        };
      }

      // Remove the urgency score marker from the response
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

  private createScoringPrompt(email: EmailMessage): string {
    return `
You are an email assistant responsible for evaluating the urgency of incoming emails.
Use the knowledge base provided below to inform your evaluations.

KNOWLEDGE BASE:
${this.knowledgeContent}

INCOMING EMAIL:
From: ${email.from.name ? email.from.name + " " : ""}<${email.from.address}>
Subject: ${email.subject}
Date: ${email.date.toISOString()}
Body:
${email.text}

Your task is to score the urgency or severity of this email on a scale from 0 to 100:
- 0-25: Low urgency, can be addressed at convenience
- 26-50: Moderate urgency, should be addressed within a few days
- 51-75: High urgency, should be addressed soon
- 76-100: Critical urgency, requires immediate attention

Factor in elements like:
- Tone (is it demanding, desperate, casual?)
- Content (what is being requested or reported?)
- Sender's position (are they a key stakeholder?)
- Time-sensitive language (deadlines, ASAP mentions)
- Impact of the issue (how serious would the consequences be if not addressed?)

Respond ONLY with the score in this exact format: [URGENCY_SCORE: X] where X is a number from 0-100.
`;
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

In addition to drafting a response, you must score the urgency or severity of this email on a scale from 0 to 100:
- 0-25: Low urgency, can be addressed at convenience
- 26-50: Moderate urgency, should be addressed within a few days
- 51-75: High urgency, should be addressed soon
- 76-100: Critical urgency, requires immediate attention

Factor in elements like tone, content, sender's position, time-sensitive language, and impact of the issue.
Include this score at the END of your response in the format: [URGENCY_SCORE: X] where X is a number from 0-100.

Make sure your response:
1. Addresses the sender's questions or concerns directly
2. Is formatted as plain text, ready to be sent as an email
3. DO NOT include the email subject in your response - it will be automatically shown in the email thread
4. ALWAYS sign the email as "Best regards,\\nMarc Beaupre" - do not use any other closing or signature
5. Don't say anything that you're unsure about - leave placeholders for the agent to fill in. It's worse to be too verbose than too short. Reviewing your drafts takes time, so be considerate of the agent's time.
6. Always be improving. Leave notes for the agent to update the knowledge base to help you in the future.
7. End with the urgency score in the specified format

YOUR RESPONSE:`;
  }
}
