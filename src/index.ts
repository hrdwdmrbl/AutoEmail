import { config } from "./config";
import { EmailService } from "./email-service";
import { AiService } from "./ai-service";
import { JmapService } from "./jmap-service";
import { DbService } from "./db-service";
import { EmailMessage } from "./types";

interface ProcessedEmail {
  emails: EmailMessage[];
  urgencyScore: number;
  draftId: string | null;
}

async function main() {
  console.log("Starting AutoEmail application...");

  // Display dry-run mode message if enabled
  if (config.dryRun) {
    console.log("🔍 DRY RUN MODE ENABLED: No drafts will be created in your email account");
  }

  try {
    // Initialize database service if configured
    const dbService = new DbService(config.dbConfig);
    await dbService.init();

    // Initialize services
    const emailService = new EmailService(config.imap);
    const aiService = new AiService(config.openaiApiKey, config.knowledgeFile, dbService);

    // Initialize JMAP service if configuration is available
    const jmapService = new JmapService(config.jmap, config.dryRun);

    // console.log("JMAP configuration found, attempting to initialize...");
    try {
      await jmapService.initSession();
      console.log("✅ JMAP service successfully initialized and validated");
      // console.log("Draft responses will be created directly in your email account");
    } catch (unknownError) {
      const error = unknownError as Error;
      console.error("❌ JMAP service validation failed:", error.message || "Unknown error");
      console.log("Will fall back to saving responses as files only");

      // Additional troubleshooting information
      const errorMsg = error.message || "";
      if (errorMsg.includes("Drafts mailbox not found")) {
        console.log("\nTroubleshooting tips:");
        console.log("1. Check that your JMAP_ACCOUNT_ID is correct");
        console.log("2. Verify that you have a Drafts folder in your email account");
        console.log("3. The Drafts folder might have a different name in your language");
      } else if (errorMsg.includes("401") || errorMsg.includes("unauthorized")) {
        console.log("\nTroubleshooting tips:");
        console.log("1. Check that your JMAP_API_KEY is correct and not expired");
        console.log("2. Verify that the API key has the required permissions");
      }

      throw error;
    }

    // Load knowledge base
    await aiService.loadKnowledgeBase();

    // Fetch recent emails
    // console.log("Fetching recent emails...");
    const emails = await emailService.fetchRecentEmails();

    // Group emails by sender address
    const emailGroups: { [senderAddress: string]: EmailMessage[] } = emails.reduce(
      (acc: { [senderAddress: string]: EmailMessage[] }, email) => {
        const senderAddress = email.from.address;
        if (!acc[senderAddress]) {
          acc[senderAddress] = [];
        }
        acc[senderAddress].push(email);
        return acc;
      },
      {}
    );

    // Sort each group by date (newest first)
    Object.keys(emailGroups).forEach((senderAddress) => {
      emailGroups[senderAddress] = emailGroups[senderAddress].sort((a, b) => b.date.getTime() - a.date.getTime());
    });

    console.log(`Grouped into ${Object.keys(emailGroups).length} sender groups`);

    // Process each email group
    const totalGroups = Object.keys(emailGroups).length;
    const emailPromises: Promise<ProcessedEmail | null>[] = Object.keys(emailGroups).map(
      async (senderAddress, groupIndex) => {
        const senderEmails = emailGroups[senderAddress];
        console.log(`\nProcessing group ${groupIndex}/${totalGroups}`);
        console.log(`  From: ${senderAddress}, ${senderEmails.length} email(s)`);

        // Use the most recent email for draft checking and responses
        const mostRecentEmail = senderEmails[0];
        // First check if a draft exists by calling JMAP with empty content
        // The method will return the existing draft ID if one exists
        // We call with empty body initially to see if a draft exists
        let existingDraftId = await jmapService.checkIfDraftExists(mostRecentEmail);

        // Still get urgency score even if draft exists, but only request the score
        const urgencyScorePromise = aiService.scoreEmailUrgency(senderEmails);

        if (existingDraftId) {
          console.log(`Draft response for ${senderAddress} already exists`);
        } else {
          // If no draft exists, generate AI response and create draft
          // console.log("No existing draft found. Generating AI response...");

          // Pass all emails from the same sender to generate a consolidated response
          const response = await aiService.generateResponse(senderEmails);

          // Create draft if JMAP is available
          // console.log(`Creating draft response via JMAP for: ${senderAddress}`);
          existingDraftId = await jmapService.createDraft(mostRecentEmail, response);
          console.log(`✅ Draft created for ${senderAddress}`);
        }

        const urgencyScore = await urgencyScorePromise;

        return {
          emails: senderEmails,
          urgencyScore: urgencyScore,
          draftId: existingDraftId,
        };
      }
    );

    const results = await Promise.all(emailPromises);

    // Print prioritized list of emails
    console.log("\n==== PRIORITIZED EMAILS BY SENDER ====");
    console.log("Severity | Subject | Sender | Email Count");
    console.log("----------------------------------------------");

    results
      .filter((result) => result !== null)
      .sort((a: ProcessedEmail, b: ProcessedEmail) => b.urgencyScore - a.urgencyScore)
      .forEach((item) => {
        const { emails, urgencyScore } = item;
        const anEmail = emails[0];
        const senderName = anEmail.from.name ? `${anEmail.from.name} ` : "";
        const emailCount = emailGroups[anEmail.from.address].length;
        const countDisplay = emailCount > 1 ? ` (${emailCount} emails)` : "";
        console.log(
          `${urgencyScore.toString().padStart(3)}     | ${anEmail.subject
            .substring(0, 30)
            .padEnd(30)} | ${senderName}<${anEmail.from.address}>${countDisplay}`
        );
      });

    // console.log("\nEmail processing completed successfully");

    // Close database connection if it was opened
    if (dbService) {
      await dbService.close();
      // console.log("Database connection closed");
    }
  } catch (error) {
    console.error("Application error:", error);
    process.exit(1);
  }
}

// Run the application
main().catch((error) => {
  console.error("Unhandled application error:", error);
  process.exit(1);
});
