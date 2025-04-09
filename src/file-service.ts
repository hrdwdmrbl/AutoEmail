import fs from 'fs-extra';
import path from 'path';
import { EmailMessage } from './types';

export class FileService {
  private responsesDir: string;

  constructor(responsesDir: string) {
    this.responsesDir = responsesDir;
  }

  /**
   * Ensures the responses directory exists
   */
  async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.responsesDir);
      console.log(`Responses directory ensured at: ${this.responsesDir}`);
    } catch (error) {
      console.error('Failed to create responses directory:', error);
      throw new Error(`Failed to create responses directory at ${this.responsesDir}`);
    }
  }

  /**
   * Saves an email response to a file
   */
  async saveResponse(email: EmailMessage, response: string): Promise<string> {
    // Create a safe filename based on the email subject and date
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const subject = email.subject.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const filename = `${timestamp}_${subject}.txt`;
    const filePath = path.join(this.responsesDir, filename);

    try {
      // Create the file content with email metadata and the AI response
      const fileContent = `
FROM: ${email.from.name ? email.from.name + ' ' : ''}<${email.from.address}>
TO: ${email.to.map(recipient => `${recipient.name ? recipient.name + ' ' : ''}<${recipient.address}>`).join(', ')}
SUBJECT: ${email.subject}
DATE: ${email.date.toISOString()}

${'-'.repeat(80)}
ORIGINAL EMAIL:
${'-'.repeat(80)}
${email.text}

${'-'.repeat(80)}
AI GENERATED RESPONSE:
${'-'.repeat(80)}
${response}
`;

      await fs.writeFile(filePath, fileContent, 'utf8');
      console.log(`Response saved to: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('Failed to save response:', error);
      throw new Error(`Failed to save response to ${filePath}`);
    }
  }
}