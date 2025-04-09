import dotenv from 'dotenv';
import { AppConfig } from './types';

// Load environment variables from .env file
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'IMAP_HOST',
  'IMAP_PORT',
  'IMAP_USER',
  'IMAP_PASSWORD',
  'OPENAI_API_KEY',
  'KNOWLEDGE_FILE'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Create and export the application configuration
export const config: AppConfig = {
  imap: {
    host: process.env.IMAP_HOST!,
    port: parseInt(process.env.IMAP_PORT!, 10),
    user: process.env.IMAP_USER!,
    password: process.env.IMAP_PASSWORD!,
    tls: process.env.IMAP_TLS !== 'false',
    mailbox: process.env.IMAP_MAILBOX || 'INBOX'
  },
  openaiApiKey: process.env.OPENAI_API_KEY!,
  knowledgeFile: process.env.KNOWLEDGE_FILE || 'knowledge.txt',
  responsesDir: process.env.RESPONSES_DIR || 'responses'
};