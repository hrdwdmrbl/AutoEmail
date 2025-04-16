import OpenAI from "openai";
import { EmailMessage } from "./types";

export class PriorityService {
  private openai: OpenAI;
  private knowledgeContent: string | null = null;

  constructor(apiKey: string, knowledgeContent: string | null = null) {
    this.openai = new OpenAI({ apiKey });
    this.knowledgeContent = knowledgeContent;
  }

  setKnowledgeContent(content: string): void {
    this.knowledgeContent = content;
  }

  async scoreEmailUrgency(email: EmailMessage): Promise<number> {
    if (!this.knowledgeContent) {
      throw new Error("Knowledge base content is not loaded");
    }

    const prompt = this.createScoringPrompt(email);

    try {
      const response = await this.openai.chat.completions.create({
        model: "o3-mini",
        messages: [{ role: "system", content: prompt }],
      });

      const content = response.choices[0]?.message.content || "";

      // Extract the urgency score (format expected: [URGENCY_SCORE: X])
      let urgencyScore = 50; // Default middle score
      const urgencyMatch = content.match(/\[URGENCY_SCORE:\s*(\d+)\]/);

      if (urgencyMatch && urgencyMatch[1]) {
        const parsedScore = parseInt(urgencyMatch[1], 10);
        // Ensure score is within 0-100 range
        urgencyScore = Math.min(100, Math.max(0, parsedScore));
      }

      return urgencyScore;
    } catch (error) {
      console.error("Error generating urgency score:", error);
      throw new Error("Failed to generate urgency score");
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
Email date: ${email.date.toISOString()}
Today's date: ${new Date().toISOString()}
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
}
