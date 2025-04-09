import imaps from "imap-simple";
import { simpleParser, ParsedMail, AddressObject } from "mailparser";
import { ImapConfig, EmailMessage } from "./types";

export class EmailService {
  private config: ImapConfig;

  constructor(config: ImapConfig) {
    this.config = config;
  }

  /**
   * Connects to the IMAP server and fetches recent emails
   */
  async fetchRecentEmails(limit = 50): Promise<EmailMessage[]> {
    console.log("Connecting to IMAP server...");

    const connection = await imaps.connect({
      imap: {
        user: this.config.user,
        password: this.config.password,
        host: this.config.host,
        port: this.config.port,
        tls: this.config.tls,
        authTimeout: 10000,
      },
    });

    console.log("Connected to IMAP server");

    try {
      await connection.openBox(this.config.mailbox);

      // Search for all emails
      const searchCriteria = ['ALL'];
      const fetchOptions = {
        bodies: ["HEADER", "TEXT", ""],
        markSeen: false,
      };

      const messages = await connection.search(searchCriteria, fetchOptions);
      console.log(`Found ${messages.length} messages`);

      // Process the most recent emails (limited by the 'limit' parameter)
      const recentMessages = messages.slice(0, limit);
      const emailMessages: EmailMessage[] = [];

      for (const message of recentMessages) {
        const all = message.parts.find((part) => part.which === "");
        if (all) {
          const parsed = await simpleParser(all.body);

          // Extract sender information
          let fromName = "";
          let fromAddress = "unknown@example.com";

          if (parsed.from) {
            const fromData = parsed.from as AddressObject;
            if (fromData.value && fromData.value.length > 0) {
              fromName = fromData.value[0].name || "";
              fromAddress = fromData.value[0].address || "unknown@example.com";
            }
          }

          // Extract recipient information
          const toRecipients = [];
          if (parsed.to) {
            const toData = parsed.to as AddressObject;
            if (toData.value && toData.value.length > 0) {
              for (const recipient of toData.value) {
                toRecipients.push({
                  name: recipient.name || "",
                  address: recipient.address || "unknown@example.com",
                });
              }
            }
          }

          const email: EmailMessage = {
            id: parsed.messageId || `temp-id-${Date.now()}`,
            date: parsed.date || new Date(),
            from: {
              name: fromName,
              address: fromAddress,
            },
            to: toRecipients,
            subject: parsed.subject || "(No Subject)",
            text: parsed.text || "",
            html: parsed.html || undefined,
          };

          emailMessages.push(email);
        }
      }

      return emailMessages;
    } finally {
      connection.end();
      console.log("Disconnected from IMAP server");
    }
  }
}
