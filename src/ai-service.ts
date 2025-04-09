import OpenAI from 'openai';
import fs from 'fs/promises';
import { EmailMessage } from './types';

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
      this.knowledgeContent = await fs.readFile(this.knowledgeFilePath, 'utf-8');
      console.log('Knowledge base loaded successfully');
    } catch (error) {
      console.error('Failed to load knowledge base:', error);
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
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        messages: [
          { role: 'system', content: prompt }
        ]
      });

      return response.choices[0]?.message.content || 
        'I apologize, but I was unable to generate a response at this time.';
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  private createPrompt(email: EmailMessage): string {
    return `
You are an email assistant responsible for drafting responses to incoming emails.
Use the knowledge base provided below to inform your responses.

KNOWLEDGE BASE:
${this.knowledgeContent}

INCOMING EMAIL:
From: ${email.from.name ? email.from.name + ' ' : ''}<${email.from.address}>
Subject: ${email.subject}
Date: ${email.date.toISOString()}
Body:
${email.text}

Draft a professional response to this email using the information from the knowledge base.
Make sure your response:
1. Addresses the sender's questions or concerns directly
2. Includes any relevant information from the knowledge base
3. Follows the tone and style guidelines in the knowledge base
4. Is concise and to the point
5. Is formatted as plain text, ready to be sent as an email

YOUR RESPONSE:`;
  }
}