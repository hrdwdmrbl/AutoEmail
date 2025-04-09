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
}

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
  mailbox: string;
}

export interface AppConfig {
  imap: ImapConfig;
  openaiApiKey: string;
  knowledgeFile: string;
  responsesDir: string;
}