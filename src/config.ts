import dotenv from "dotenv";
import { AppConfig } from "./types";

// Load environment variables from .env file
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ["IMAP_HOST", "IMAP_PORT", "IMAP_USER", "IMAP_PASSWORD", "OPENAI_API_KEY", "KNOWLEDGE_FILE"];

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
    tls: process.env.IMAP_TLS !== "false",
    mailbox: process.env.IMAP_MAILBOX || "INBOX",
  },
  openaiApiKey: process.env.OPENAI_API_KEY!,
  knowledgeFile: process.env.KNOWLEDGE_FILE || "knowledge.md",
  responsesDir: process.env.RESPONSES_DIR || "responses",
  jmap: {
    // Use the explicit session URL if provided, otherwise construct one from the email domain
    sessionUrl: process.env.JMAP_SESSION_URL!,
    apiKey: process.env.JMAP_API_KEY!,
  },
};

// Add JMAP configuration if required environment variables are available
// Set account ID if explicitly provided
if (process.env.JMAP_ACCOUNT_ID) {
  config.jmap.accountId = process.env.JMAP_ACCOUNT_ID;
}

// Set email address for auto-discovery if provided
if (process.env.JMAP_EMAIL_ADDRESS) {
  config.jmap.emailAddress = process.env.JMAP_EMAIL_ADDRESS;

  // If session URL was not provided, construct it from the email domain
  if (!process.env.JMAP_SESSION_URL) {
    const domain = process.env.JMAP_EMAIL_ADDRESS.split("@")[1];
    config.jmap.sessionUrl = `https://${domain}/.well-known/jmap`;
  }
}
