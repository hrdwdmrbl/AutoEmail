import axios from "axios";
import { JmapConfig, EmailMessage } from "./types";

/**
 * JMAP Service for interacting with JMAP-compliant email servers
 */
export class JmapService {
  private config: JmapConfig;
  private sessionData: any = null;
  private accountId: string | null = null;
  private dryRun: boolean = false;

  constructor(config: JmapConfig, dryRun: boolean = false) {
    this.config = config;
    this.dryRun = dryRun;
  }

  /**
   * Initialize the JMAP session and verify configuration
   */
  async initSession(): Promise<void> {
    try {
      // Get the session URL (handling redirects if needed)
      const sessionUrl = await this.getSessionUrl();

      // Initialize the session
      // console.log(`Connecting to JMAP session at ${sessionUrl}`);
      const response = await this.makeRequest("get", sessionUrl);
      this.sessionData = response.data;
      console.log("✅ JMAP session initialized successfully");

      // Verify the configuration
      await this.validateConfiguration();
    } catch (error) {
      this.handleError("Failed to initialize JMAP session", error);
    }
  }

  /**
   * Create a draft email response if one doesn't already exist
   */
  async createDraft(originalEmail: EmailMessage, responseBody: string): Promise<string | null> {
    if (this.dryRun) {
      return null;
    }

    if (!this.sessionData) {
      await this.initSession();
    }

    try {
      // Get essential data for the draft creation
      const apiUrl = this.sessionData.apiUrl;
      const accountId = await this.getAccountId();
      const mailboxes = await this.getMailboxes(apiUrl, accountId);
      const draftMailboxId = this.findDraftsMailbox(mailboxes);

      if (!draftMailboxId) {
        throw new Error(
          "Drafts mailbox not found. Available mailboxes: " +
            mailboxes.map((m) => `${m.name}${m.role ? ` (${m.role})` : ""}`).join(", ")
        );
      }

      // Prepare the email subject (adding Re: prefix if needed)
      const emailSubject = this.createReplySubject(originalEmail.subject);

      // Check if a draft already exists for this email
      const existingDraftId = await this.checkForExistingDraft(apiUrl, accountId, draftMailboxId, originalEmail);
      if (existingDraftId) {
        console.log(`Draft already exists for email with ID ${originalEmail.id}, skipping creation`);
        return existingDraftId;
      }

      // Log what we're about to do
      this.logDraftCreationDetails(originalEmail, emailSubject, responseBody);

      // Get thread references from original email
      // We're intentionally NOT using inReplyTo field since Fastmail rejects it
      const references = this.getThreadReferences(originalEmail);

      // Create draft with proper threading via the references field only
      const request = {
        using: ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
        methodCalls: [
          [
            "Email/set",
            {
              accountId,
              create: {
                draft1: {
                  mailboxIds: { [draftMailboxId]: true },
                  from: [
                    {
                      name: "Marc Beaupre",
                      email: this.config.emailAddress || originalEmail.to[0]?.address || "",
                    },
                  ],
                  to: [
                    {
                      name: originalEmail.from.name || "",
                      email: originalEmail.from.address,
                    },
                  ],
                  subject: emailSubject,
                  bodyValues: {
                    body: { value: responseBody, charset: "utf-8" },
                  },
                  textBody: [{ partId: "body", type: "text/plain" }],
                  keywords: { $draft: true },
                  // Use references array for threading WITHOUT inReplyTo
                  // Fastmail specifically rejects inReplyTo but references works
                  references: references,
                },
              },
            },
            "0",
          ],
        ],
      };

      console.log("Sending JMAP request to create draft...");
      const response = await this.makeRequest("post", apiUrl, request);

      const methodResponse = response.data.methodResponses[0];

      if (methodResponse[0] === "Email/set" && methodResponse[1]?.created?.draft1?.id) {
        const draftId = methodResponse[1].created.draft1.id;
        console.log(`Draft created successfully with ID: ${draftId}`);
        return draftId;
      }

      if (methodResponse[0] === "Email/set" && methodResponse[1]?.notCreated?.draft1) {
        const error = methodResponse[1].notCreated.draft1;

        // If references field causes problems, try without it
        if (error.type === "invalidProperties" && error.properties?.includes("references")) {
          console.log("References field rejected, trying without threading properties...");
          return this.createSimpleDraft(apiUrl, accountId, draftMailboxId, originalEmail, emailSubject, responseBody);
        }

        throw new Error(`Server rejected draft creation: ${error.type} - ${error.description || "No description"}`);
      }

      throw new Error("Draft creation failed with unexpected response format");
    } catch (error) {
      return this.handleError("Failed to create draft email", error);
    }
  }

  /**
   * Public method to check if a draft already exists for the given email
   * This can be called separately before generating AI responses
   */
  async checkIfDraftExists(originalEmail: EmailMessage): Promise<string | null> {
    // In dry-run mode, always return null to indicate no draft exists
    if (this.dryRun) {
      return null;
    }

    if (!this.sessionData) {
      await this.initSession();
    }

    try {
      const apiUrl = this.sessionData.apiUrl;
      const accountId = await this.getAccountId();
      const mailboxes = await this.getMailboxes(apiUrl, accountId);
      const draftMailboxId = this.findDraftsMailbox(mailboxes);

      if (!draftMailboxId) {
        console.log("Drafts mailbox not found, cannot check for existing drafts");
        return null;
      }

      // Use the private method to check for existing drafts
      return await this.checkForExistingDraft(apiUrl, accountId, draftMailboxId, originalEmail);
    } catch (error) {
      console.error("Error checking if draft exists:", error);
      return null;
    }
  }

  /**
   * Check if a draft response already exists for the given email
   */
  private async checkForExistingDraft(
    apiUrl: string,
    accountId: string,
    draftMailboxId: string,
    originalEmail: EmailMessage
  ): Promise<string | null> {
    console.log(`Checking for existing drafts to ${originalEmail.from.address} about "${originalEmail.subject}"`);

    try {
      // Prepare the email subject with Re: prefix
      const emailSubject = this.createReplySubject(originalEmail.subject);

      // Create a search filter for drafts that match our criteria
      const request = {
        using: ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
        methodCalls: [
          [
            "Email/query",
            {
              accountId,
              filter: {
                operator: "AND",
                conditions: [
                  { inMailbox: draftMailboxId },
                  { hasKeyword: "$draft" },
                  { to: originalEmail.from.address },
                  { subject: emailSubject },
                ],
              },
              sort: [{ property: "receivedAt", isAscending: false }],
              limit: 1,
            },
            "0",
          ],
        ],
      };

      const response = await this.makeRequest("post", apiUrl, request);
      const methodResponse = response.data.methodResponses[0];

      if (methodResponse[0] === "Email/query" && methodResponse[1]?.ids) {
        const ids = methodResponse[1].ids;

        if (ids.length > 0) {
          console.log(`Found existing draft with ID: ${ids[0]}`);
          return ids[0];
        }
      }

      console.log("No existing draft found, proceeding with creation");
      return null;
    } catch (error) {
      console.error("Error checking for existing drafts:", error);
      // If the check fails, we'll just proceed with creating a new draft
      return null;
    }
  }

  /**
   * Create a simple draft without any threading properties
   */
  private async createSimpleDraft(
    apiUrl: string,
    accountId: string,
    draftMailboxId: string,
    originalEmail: EmailMessage,
    emailSubject: string,
    responseBody: string
  ): Promise<string> {
    // Last resort: create a draft with no threading information
    const request = {
      using: ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
      methodCalls: [
        [
          "Email/set",
          {
            accountId,
            create: {
              draft1: {
                mailboxIds: { [draftMailboxId]: true },
                from: [
                  {
                    name: "Marc Beaupre",
                    email: this.config.emailAddress || originalEmail.to[0]?.address || "",
                  },
                ],
                to: [
                  {
                    name: originalEmail.from.name || "",
                    email: originalEmail.from.address,
                  },
                ],
                subject: emailSubject,
                bodyValues: { body: { value: responseBody, charset: "utf-8" } },
                textBody: [{ partId: "body", type: "text/plain" }],
                keywords: { $draft: true },
                // No threading properties at all
              },
            },
          },
          "0",
        ],
      ],
    };

    console.log("Sending simple draft request without threading...");
    const response = await this.makeRequest("post", apiUrl, request);

    const methodResponse = response.data.methodResponses[0];

    if (methodResponse[0] === "Email/set" && methodResponse[1]?.created?.draft1?.id) {
      const draftId = methodResponse[1].created.draft1.id;
      console.log(`Simple draft created successfully with ID: ${draftId}`);
      return draftId;
    }

    throw new Error("All draft creation attempts failed");
  }

  /**
   * Get thread references for proper reply association
   */
  private getThreadReferences(originalEmail: EmailMessage): string[] {
    const references: string[] = [];

    // Add existing references if available
    if (originalEmail.references && originalEmail.references.length > 0) {
      if (Array.isArray(originalEmail.references)) {
        references.push(...originalEmail.references);
      } else {
        references.push(originalEmail.references as string);
      }
    }

    // Add messageId from original email if available
    if (originalEmail.messageId) {
      const messageId = Array.isArray(originalEmail.messageId) ? originalEmail.messageId[0] : originalEmail.messageId;

      // Add to references if not already there
      if (messageId && !references.includes(messageId)) {
        references.push(messageId);
      }
    }

    // If we still don't have any references, try using originalEmail.id with proper formatting
    if (references.length === 0 && originalEmail.id) {
      const formattedId = this.formatMessageId(originalEmail.id);
      references.push(formattedId);
    }

    return references;
  }

  /**
   * Format an ID as a valid message ID if needed
   */
  private formatMessageId(id: string): string {
    // If already formatted with angle brackets, return as is
    if (id.startsWith("<") && id.endsWith(">")) {
      return id;
    }

    // Format with angle brackets
    const domain = this.extractDomainFromEmail() || "example.com";
    return `<${id}@${domain}>`;
  }

  /**
   * Creates a reply subject by adding Re: if needed
   */
  private createReplySubject(subject: string): string {
    return subject.startsWith("Re:") ? subject : `Re: ${subject}`;
  }

  /**
   * Log details about the draft email we're creating
   */
  private logDraftCreationDetails(originalEmail: EmailMessage, emailSubject: string, responseBody: string): void {
    console.log("Creating draft with the following data:");
    console.log("- From:", this.config.emailAddress || originalEmail.to[0]?.address || "unknown");
    console.log("- To:", originalEmail.from.address);
    console.log("- Subject:", emailSubject);
    console.log("- Content length:", responseBody.length, "characters");
    console.log("- Original Email ID:", originalEmail.id || "unknown");
  }

  /**
   * Extract domain from configured email address
   */
  private extractDomainFromEmail(): string | null {
    if (this.config.emailAddress && this.config.emailAddress.includes("@")) {
      return this.config.emailAddress.split("@")[1];
    }
    return null;
  }

  /**
   * Gets the JMAP session URL, handling redirects for .well-known URLs
   */
  private async getSessionUrl(): Promise<string> {
    let sessionUrl = this.config.sessionUrl;

    // Handle redirects for .well-known URLs
    if (sessionUrl.includes(".well-known/jmap")) {
      try {
        console.log(`Checking for redirects at ${sessionUrl}...`);
        const headResponse = await axios.head(sessionUrl, {
          maxRedirects: 0,
          validateStatus: (status) => status >= 200 && status < 400,
        });

        if (headResponse.headers.location) {
          sessionUrl = headResponse.headers.location;
          console.log(`Following redirect to ${sessionUrl}`);
        }
      } catch (redirectError: any) {
        if (redirectError.response?.headers?.location) {
          sessionUrl = redirectError.response.headers.location;
          console.log(`Following redirect to ${sessionUrl}`);
        } else {
          console.log("No redirects found");
        }
      }
    }

    return sessionUrl;
  }

  /**
   * Make a request with proper error handling
   */
  private async makeRequest(method: "get" | "post", url: string, data?: any): Promise<any> {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
      };

      if (method === "get") {
        return await axios.get(url, config);
      } else {
        return await axios.post(url, data, config);
      }
    } catch (error) {
      this.logRequestError(error);
      throw error;
    }
  }

  /**
   * Log detailed request error information
   */
  private logRequestError(error: any): void {
    if (error.response) {
      console.error("Server Error Response:", {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
      });
    } else if (error.request) {
      console.error("No response received from server");
    } else {
      console.error("Error message:", error.message);
    }
  }

  /**
   * Handle errors with detailed logging
   */
  private handleError(context: string, error: any): never {
    this.logRequestError(error);

    const errorMessage =
      error.response?.data?.detail || error.response?.data?.message || error.message || "Unknown error";

    throw new Error(`${context}: ${errorMessage}`);
  }

  /**
   * Validate the JMAP configuration
   */
  private async validateConfiguration(): Promise<void> {
    if (!this.sessionData) {
      throw new Error("JMAP session not initialized");
    }

    // Check required capabilities
    const capabilities = this.sessionData.capabilities || {};
    if (!capabilities["urn:ietf:params:jmap:mail"]) {
      throw new Error("JMAP mail capability not available");
    }

    // Check API URL
    const apiUrl = this.sessionData.apiUrl;
    if (!apiUrl) {
      throw new Error("JMAP API URL not found in session data");
    }

    // Discover account ID
    const accountId = await this.getAccountId();
    // console.log(`Using account ID: ${accountId}`);

    // Check for mailboxes
    const mailboxes = await this.getMailboxes(apiUrl, accountId);
    if (mailboxes.length === 0) {
      throw new Error(`No mailboxes found in the account with ID: ${accountId}`);
    }

    // Find drafts mailbox
    const draftMailboxId = this.findDraftsMailbox(mailboxes);
    if (!draftMailboxId) {
      throw new Error(
        "Drafts mailbox not found. Available mailboxes: " +
          mailboxes.map((m) => `${m.name}${m.role ? ` (${m.role})` : ""}`).join(", ")
      );
    }

    // console.log(`Drafts mailbox found with ID: ${draftMailboxId}`);
  }

  /**
   * Gets the account ID, either from config or by discovering it
   */
  private async getAccountId(): Promise<string> {
    // Return cached account ID if already discovered
    if (this.accountId) {
      return this.accountId;
    }

    // If account ID is explicitly provided in config, use it
    if (this.config.accountId) {
      this.accountId = this.config.accountId;
      return this.accountId;
    }

    // If we have an email address but no session data, discover the account
    if (this.config.emailAddress && this.sessionData) {
      const emailAddress = this.config.emailAddress.toLowerCase();
      const accounts = this.sessionData.accounts || {};

      // console.log(`Looking for account ID for ${emailAddress}...`);

      // Try exact match on name or email
      for (const accountId in accounts) {
        const account = accounts[accountId];

        if (
          (account.name && account.name.toLowerCase() === emailAddress) ||
          (account.email && account.email.toLowerCase() === emailAddress)
        ) {
          console.log(`✅ Found account ID for ${emailAddress}: ${accountId}`);
          this.accountId = accountId;
          return accountId;
        }
      }

      // Try partial match
      for (const accountId in accounts) {
        const account = accounts[accountId];

        if (account.name && account.name.toLowerCase().includes(emailAddress)) {
          console.log(`✅ Found account ID for ${emailAddress} by partial match: ${accountId}`);
          this.accountId = accountId;
          return accountId;
        }
      }

      // If only one account, use it
      const accountIds = Object.keys(accounts);
      if (accountIds.length === 1) {
        const accountId = accountIds[0];
        console.log(`Using the only available account ID: ${accountId}`);
        this.accountId = accountId;
        return accountId;
      }
    }

    throw new Error(
      "No account ID provided and auto-discovery failed. Please set JMAP_ACCOUNT_ID or JMAP_EMAIL_ADDRESS."
    );
  }

  /**
   * Get all mailboxes from the account
   */
  private async getMailboxes(apiUrl: string, accountId: string | null): Promise<any[]> {
    if (!accountId) {
      accountId = await this.getAccountId();
    }

    try {
      const request = {
        using: ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
        methodCalls: [["Mailbox/get", { accountId }, "0"]],
      };

      const response = await this.makeRequest("post", apiUrl, request);
      return response.data.methodResponses[0][1].list || [];
    } catch (error) {
      return this.handleError("Failed to fetch mailboxes", error);
    }
  }

  /**
   * Find the Drafts mailbox
   */
  private findDraftsMailbox(mailboxes: any[]): string | null {
    // First try by role (standard approach)
    const draftsByRole = mailboxes.find((mailbox) => mailbox.role === "drafts");
    if (draftsByRole) {
      // console.log(`Found drafts mailbox by role: ${draftsByRole.name}`);
      return draftsByRole.id;
    }

    // Try by exact name match
    const draftsNames = ["Drafts", "Draft"];
    for (const name of draftsNames) {
      const draftsByName = mailboxes.find((mailbox) => mailbox.name.toLowerCase() === name.toLowerCase());
      if (draftsByName) {
        console.log(`Found drafts mailbox by exact name match: ${draftsByName.name}`);
        return draftsByName.id;
      }
    }

    // Try by partial name match
    const draftsKeywords = ["draft"];
    for (const keyword of draftsKeywords) {
      const draftsByPartialName = mailboxes.find((mailbox) =>
        mailbox.name.toLowerCase().includes(keyword.toLowerCase())
      );
      if (draftsByPartialName) {
        console.log(`Found drafts mailbox by partial name match: ${draftsByPartialName.name}`);
        return draftsByPartialName.id;
      }
    }

    // If we still can't find drafts, log all mailboxes for debugging
    console.log(
      "Available mailboxes:",
      mailboxes.map((m) => `${m.name}${m.role ? ` (${m.role})` : ""}`)
    );

    // Return null to indicate failure
    return null;
  }
}
