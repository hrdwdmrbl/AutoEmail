import { config } from './config';
import { EmailService } from './email-service';
import { AiService } from './ai-service';
import { FileService } from './file-service';

async function main() {
  console.log('Starting AutoEmail application...');

  try {
    // Initialize services
    const emailService = new EmailService(config.imap);
    const aiService = new AiService(config.openaiApiKey, config.knowledgeFile);
    const fileService = new FileService(config.responsesDir);

    // Ensure the responses directory exists
    await fileService.initialize();

    // Load knowledge base
    await aiService.loadKnowledgeBase();

    // Fetch recent emails
    console.log('Fetching recent emails...');
    const emails = await emailService.fetchRecentEmails();
    console.log(`Processing ${emails.length} emails`);

    // Process each email
    for (const [index, email] of emails.entries()) {
      console.log(`\nProcessing email ${index + 1}/${emails.length}`);
      console.log(`From: ${email.from.address}, Subject: ${email.subject}`);

      try {
        // Generate AI response
        console.log('Generating AI response...');
        const response = await aiService.generateResponse(email);

        // Save response to file
        console.log('Saving response to file...');
        const filePath = await fileService.saveResponse(email, response);
        
        console.log(`Response for email ${index + 1} saved to: ${filePath}`);
      } catch (error) {
        console.error(`Failed to process email ${index + 1}:`, error);
      }
    }

    console.log('\nEmail processing completed successfully');
  } catch (error) {
    console.error('Application error:', error);
    process.exit(1);
  }
}

// Run the application
main().catch(error => {
  console.error('Unhandled application error:', error);
  process.exit(1);
});