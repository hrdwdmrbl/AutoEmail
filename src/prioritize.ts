import { config } from "./config";
import { EmailService } from "./email-service";
import { PriorityService } from "./priority-service";
import fs from "fs/promises";
import { EmailMessage } from "./types";

async function main() {
  console.log("Starting email prioritization...");

  try {
    // Initialize services
    const emailService = new EmailService(config.imap);
    const priorityService = new PriorityService(config.openaiApiKey);
    
    // Load knowledge base
    const knowledgeContent = await fs.readFile(config.knowledgeFile, "utf-8");
    priorityService.setKnowledgeContent(knowledgeContent);
    console.log("Knowledge base loaded successfully");

    // Fetch recent emails
    console.log("Fetching recent emails...");
    const emails = await emailService.fetchRecentEmails();
    console.log(`Processing ${emails.length} emails`);

    // Array to store emails with their priority scores
    const scoredEmails: { email: EmailMessage; urgencyScore: number }[] = [];

    // Process each email
    for (const [index, email] of emails.entries()) {
      console.log(`\nScoring email ${index + 1}/${emails.length}`);
      console.log(`From: ${email.from.address}, Subject: ${email.subject}`);

      try {
        // Get urgency score
        const urgencyScore = await priorityService.scoreEmailUrgency(email);
        
        // Store the score in the email object
        email.urgencyScore = urgencyScore;
        
        // Add to scored emails array
        scoredEmails.push({ email, urgencyScore });
        
        console.log(`Email scored with urgency: ${urgencyScore}`);
      } catch (error) {
        console.error(`Failed to score email ${index + 1}:`, error);
      }
    }

    // Sort emails by urgency score (highest first)
    scoredEmails.sort((a, b) => b.urgencyScore - a.urgencyScore);

    // Print prioritized list of emails
    if (scoredEmails.length > 0) {
      console.log("\n==== PRIORITIZED EMAILS ====");
      console.log("Severity | Subject | Sender");
      console.log("---------------------------------");
      
      for (const { email, urgencyScore } of scoredEmails) {
        const senderName = email.from.name ? `${email.from.name} ` : "";
        console.log(`${urgencyScore.toString().padStart(3)}     | ${email.subject.substring(0, 30).padEnd(30)} | ${senderName}<${email.from.address}>`);
      }
    }

    console.log("\nEmail prioritization completed successfully");
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