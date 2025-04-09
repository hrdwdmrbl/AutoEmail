# AutoEmail

An automated email response generator that reads emails via IMAP and creates AI-generated responses based on a knowledge file.

## Features

- Connects to any IMAP email server
- Fetches all emails (not just unread ones)
- Generates AI responses using OpenAI's GPT models
- Uses a knowledge file to inform responses
- Saves responses as text files for review

## Prerequisites

- Node.js (v16 or higher)
- npm
- An IMAP-enabled email account
- OpenAI API key

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
# IMAP Configuration
IMAP_HOST=mail.example.com
IMAP_PORT=993
IMAP_USER=your_email@example.com
IMAP_PASSWORD=your_password
IMAP_TLS=true
IMAP_MAILBOX=INBOX

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# App Configuration
KNOWLEDGE_FILE=knowledge.txt
RESPONSES_DIR=responses
```

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
4. Save responses in the responses directory (default: `./responses`)

## Building

To build the application:

```bash
npm run build
```

This will compile TypeScript to JavaScript in the `dist` directory.

## License

MIT