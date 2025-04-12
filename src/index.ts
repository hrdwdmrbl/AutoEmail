import { config } from "./config";
import { EmailService } from "./email-service";
import { AiService } from "./ai-service";
import { JmapService } from "./jmap-service";
import { FileService } from "./file-service";
import { EmailMessage } from "./types";

interface ProcessedEmail {
  email: EmailMessage;
  response: string;
  urgencyScore: number;
  draftId?: string;
}

async function main() {
  console.log("Starting AutoEmail application...");

  try {
    // Initialize services
    const emailService = new EmailService(config.imap);
    const aiService = new AiService(config.openaiApiKey, config.knowledgeFile);
    const fileService = new FileService(config.responsesDir);

    // Initialize JMAP service if configuration is available
    let jmapServiceAvailable = false;
    const jmapService = new JmapService(config.jmap);

    console.log("JMAP configuration found, attempting to initialize...");
    try {
      await jmapService.initSession();
      console.log("✅ JMAP service successfully initialized and validated");
      console.log("Draft responses will be created directly in your email account");
      jmapServiceAvailable = true;
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
    }

    // Initialize file service
    await fileService.initialize();

    // Load knowledge base
    await aiService.loadKnowledgeBase();

    // Fetch recent emails
    console.log("Fetching recent emails...");
    const emails = await emailService.fetchRecentEmails();
    console.log(`Processing ${emails.length} emails`);

    // Array to store processed emails information
    const processedEmails: ProcessedEmail[] = [];

    // Process each email
    for (const [index, email] of emails.entries()) {
      console.log(`\nProcessing email ${index + 1}/${emails.length}`);
      console.log(`From: ${email.from.address}, Subject: ${email.subject}`);

      try {
        // First check if a draft exists by calling JMAP with empty content
        // The method will return the existing draft ID if one exists
        console.log("Checking for existing draft response...");
        try {
          // We call with empty body initially to see if a draft exists
          const existingDraftId = await jmapService.checkIfDraftExists(email);

          if (existingDraftId) {
            console.log(`Draft response for email ${index + 1} already exists with ID: ${existingDraftId}`);
            
            // Still get urgency score even if draft exists, but only request the score
            console.log("Draft exists, but still scoring email urgency...");
            const { urgencyScore } = await aiService.generateResponse(email, true);
            
            // Store urgency score in the email object
            email.urgencyScore = urgencyScore;
            
            // Add to processed emails array with existing draft info
            processedEmails.push({
              email,
              response: "Existing draft", // Placeholder 
              urgencyScore,
              draftId: existingDraftId
            });
            
            console.log(`Email scored with urgency: ${urgencyScore}`);
            
            continue; // Skip to the next email, but urgency is now scored
          }

          // If no draft exists, generate AI response and create draft
          console.log("No existing draft found. Generating AI response...");
          const { response, urgencyScore } = await aiService.generateResponse(email);

          // Store urgency score in the email object
          email.urgencyScore = urgencyScore;

          // Add to processed emails array
          processedEmails.push({
            email,
            response,
            urgencyScore
          });

          // Save response to file
          await fileService.saveResponse(email, response);

          // Create draft if JMAP is available
          if (jmapServiceAvailable) {
            console.log("Creating draft response via JMAP...");
            const draftId = await jmapService.createDraft(email, response);
            console.log(`Draft response for email ${index + 1} created with ID: ${draftId}`);
            
            // Update processed email with draft ID
            processedEmails[processedEmails.length - 1].draftId = draftId;
          }
        } catch (unknownError) {
          const jmapError = unknownError as Error;
          console.error("Failed to create draft via JMAP:", jmapError.message || "Unknown error");
        }
      } catch (error) {
        console.error(`Failed to process email ${index + 1}:`, error);
      }
    }

    // Sort processed emails by urgency score (highest first)
    processedEmails.sort((a, b) => b.urgencyScore - a.urgencyScore);

    // Print prioritized list of emails
    if (processedEmails.length > 0) {
      console.log("\n==== PRIORITIZED EMAILS ====");
      console.log("Severity | Subject | Sender");
      console.log("---------------------------------");
      
      for (const item of processedEmails) {
        const { email, urgencyScore } = item;
        const senderName = email.from.name ? `${email.from.name} ` : "";
        console.log(`${urgencyScore.toString().padStart(3)}     | ${email.subject.substring(0, 30).padEnd(30)} | ${senderName}<${email.from.address}>`);
      }
    }

    console.log("\nEmail processing completed successfully");
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
