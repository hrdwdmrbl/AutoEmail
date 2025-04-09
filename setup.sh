#!/bin/bash

# AutoEmail Setup Script

echo "Setting up AutoEmail..."

# Create necessary directories
echo "Creating necessary directories..."
mkdir -p responses

# Install dependencies
echo "Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env file..."
  cp .env.example .env
  echo "Please edit the .env file with your IMAP and OpenAI API credentials."
else
  echo ".env file already exists. Skipping creation."
fi

# Build the project
echo "Building the project..."
npm run build

echo ""
echo "Setup complete! To run the app:"
echo "1. Make sure you've updated your .env file with proper credentials"
echo "2. Run 'npm start' to process emails"
echo ""
echo "For more information, please read the README.md file."