import { config } from "./config";
import { EmailService } from "./email-service";
import { PriorityService } from "./priority-service";
import fs from "fs/promises";
import { EmailMessage } from "./types";

type SenderGroupScore = {
  emails: EmailMessage[];
  urgencyScore: number;
};

async function main() {
  console.log("Starting email prioritization...");

  try {
    // Initialize services
    const emailService = new EmailService(config.imap);
    const priorityService = new PriorityService(config.openaiApiKey);

    // Load knowledge base
    const knowledgeContent = await fs.readFile(config.knowledgeFile, "utf-8");
    priorityService.setKnowledgeContent(knowledgeContent);
    console.log("✅ Knowledge base loaded successfully");

    // Fetch recent emails
    // console.log("Fetching recent emails...");
    const emails = await emailService.fetchRecentEmails();
    console.log(`✅ Fetched ${emails.length} emails`);

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
    const scoredEmails: Promise<SenderGroupScore>[] = Object.keys(emailGroups).map(
      async (senderAddress, groupIndex) => {
        const senderEmails = emailGroups[senderAddress];
        console.log(`\nScoring email group ${groupIndex + 1}/${Object.keys(emailGroups).length}`);
        console.log(`From: ${senderAddress}, ${senderEmails.length} email(s)`);

        // Get urgency score for the group
        const urgencyScore = await priorityService.scoreEmailUrgency(senderEmails);

        // Add to scored emails array (one entry per sender)
        return { emails: senderEmails, urgencyScore };
      }
    );

    const results = await Promise.all(scoredEmails);

    // Print prioritized list of emails
    console.log("\n==== PRIORITIZED EMAILS BY SENDER ====");
    console.log("Severity | Subject | Sender | Email Count");
    console.log("----------------------------------------------");

    results
      .filter((result) => result !== null)
      .sort((a: SenderGroupScore, b: SenderGroupScore) => b.urgencyScore - a.urgencyScore)
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
