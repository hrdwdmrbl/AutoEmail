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

  async scoreEmailUrgency(emails: EmailMessage[]): Promise<number> {
    if (!this.knowledgeContent) {
      throw new Error("Knowledge base content is not loaded");
    }

    const prompt = this.createScoringPrompt(emails);

    console.log(emails[0].from);
    console.log(prompt);

    const response = await this.openai.chat.completions.create({
      model: "o4-mini",
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
  }

  private createScoringPrompt(emails: EmailMessage[]): string {
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
You are an email assistant responsible for evaluating the urgency of incoming emails.
Use the knowledge base provided below to inform your evaluations.

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

Your task is to score the urgency or severity of this email on a scale from 0 to 100:
- 0-25: Low urgency, can be addressed at convenience
- 26-50: Moderate urgency, should be addressed within a few days
- 51-75: High urgency, should be addressed soon
- 76-100: Critical urgency, requires immediate attention

Factor in elements like:
- Tone (is it demanding, desperate, casual?)
- Content (what is being requested or reported?)
- Time-sensitive language (deadlines, ASAP mentions)
- Impact of the issue (how serious would the consequences be if not addressed?)
- Time since the email was sent. The longer it has been, the more urgent it becomes.
- Threats - such as of a bad review.
- Number of emails from the same sender.

Respond ONLY with the score in this exact format: [URGENCY_SCORE: X] where X is a number from 0-100.
`;
  }
}
