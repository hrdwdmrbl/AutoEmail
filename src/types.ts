export interface EmailMessage {
  id: string;
  date: Date;
  from: {
    name?: string;
    address: string;
  };
  to: {
    name?: string;
    address: string;
  }[];
  subject: string;
  text: string;
  html?: string;
  // Additional fields for thread handling
  threadId?: string;
  // In Fastmail's implementation, messageId is an array of strings
  messageId?: string | string[];
  references?: string[];
  inReplyTo?: string | string[];
}

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
  mailbox: string;
}

export interface JmapConfig {
  sessionUrl: string;
  apiKey: string;
  accountId?: string;
  emailAddress?: string;
}

export interface AppConfig {
  imap: ImapConfig;
  jmap: JmapConfig;
  openaiApiKey: string;
  knowledgeFile: string;
  responsesDir: string;
}
