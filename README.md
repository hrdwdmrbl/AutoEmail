# AutoEmail

An automated email response generator that reads emails via IMAP and creates AI-generated responses based on a knowledge file.

## Features

- Connects to any IMAP email server
- Fetches all emails (not just unread ones)
- Generates AI responses using OpenAI's GPT models
- Uses a knowledge file to inform responses
- Creates draft responses directly in your email account using JMAP (Fastmail API)
- Falls back to saving responses as text files if JMAP is not configured

## Prerequisites

- Node.js (v16 or higher)
- npm
- An IMAP-enabled email account
- OpenAI API key
- Fastmail account with API key (for JMAP draft creation feature)

## Installation

1. Clone this repository
2. Run the setup script:

```bash
./setup.sh
```

The setup script will:
- Create necessary directories
- Install dependencies
- Create a `.env` file from the template if it doesn't exist
- Build the TypeScript code

3. Edit the `.env` file with your IMAP credentials and OpenAI API key

## Configuration

Edit your `.env` file with the following settings:

```
# IMAP Configuration (for reading emails)
IMAP_HOST=mail.example.com
IMAP_PORT=993
IMAP_USER=your_email@example.com
IMAP_PASSWORD=your_password
IMAP_TLS=true
IMAP_MAILBOX=INBOX

# JMAP Configuration (for creating draft responses)
JMAP_SESSION_URL=https://api.fastmail.com/jmap/session
JMAP_API_KEY=your_jmap_api_key
JMAP_ACCOUNT_ID=your_account_id

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# App Configuration
KNOWLEDGE_FILE=knowledge.txt
RESPONSES_DIR=responses
```

## JMAP Configuration (Fastmail API)

To use the JMAP feature for creating draft responses directly in your email account:

1. Log in to your Fastmail account
2. Go to Settings > Password & Security > API Tokens
3. Create a new API token with the following permissions:
   - Mail - Full Access
4. Copy the token to your `.env` file as `JMAP_API_KEY`
5. Set either:
   - `JMAP_EMAIL_ADDRESS` to your email address (recommended, enables auto-discovery)
   - OR `JMAP_ACCOUNT_ID` to your account ID (if you know it)
6. The session URL for Fastmail is: `https://api.fastmail.com/jmap/session`

### Account ID Auto-Discovery

The application can automatically discover your account ID when you provide your email address:

- Set `JMAP_EMAIL_ADDRESS` in your `.env` file to your full email address
- The app will connect to the JMAP server and find the matching account
- It uses multiple matching strategies to find the right account:
  - Exact match on the account name or email property
  - Partial match if your email appears within the account name
  - If only one account is available, it uses that account
- Auto-discovery is more user-friendly than manually finding your account ID

### Validation at Startup

The application performs a validation check of your JMAP configuration at startup:

1. Connects to the JMAP session endpoint
2. Verifies the required mail capabilities are available
3. Fetches all mailboxes in your account
4. Tries to locate the Drafts folder (supports multiple languages)
5. Provides detailed error messages and troubleshooting tips if validation fails

If validation succeeds, draft emails will be created directly in your email account. If it fails, the application will fall back to saving responses as text files only.

For more information, see the [Fastmail API documentation](https://www.fastmail.com/dev/).

## Knowledge File

The knowledge file (`knowledge.txt` by default) contains information used to inform the AI responses. Edit this file to include:

- Company information
- Product details
- Pricing
- Common FAQs
- Response guidelines

## Usage

Run the application to process recent unread emails:

```bash
npm start
```

The application will:
1. Connect to your email via IMAP
2. Fetch all emails (limited to the most recent 50 by default)
3. Generate AI responses based on your knowledge file
4. If JMAP is configured:
   - Create draft responses directly in your email account
   - Save backup copies to the responses directory
5. If JMAP is not configured:
   - Save responses in the responses directory (default: `./responses`)

## Building

To build the application:

```bash
npm run build
```

This will compile TypeScript to JavaScript in the `dist` directory.

## License

MIT