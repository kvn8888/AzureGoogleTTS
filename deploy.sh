#!/bin/bash

# Azure Function Deployment Script
# This script deploys the function using the same command as GitHub Actions

set -e  # Exit on error

echo "🚀 Starting Azure Function deployment..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root directory."
    exit 1
fi

# Check if terraform directory exists
if [ ! -d "terraform" ]; then
    echo "❌ Error: terraform directory not found. Please ensure Terraform is set up."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Get function app name from Terraform
echo "🏗️  Getting function app name from Terraform..."
cd terraform
FUNCTION_APP_NAME=$(terraform output -raw function_app_name 2>/dev/null)

if [ -z "$FUNCTION_APP_NAME" ]; then
    echo "❌ Error: Could not get function app name from Terraform output."
    echo "   Make sure you've run 'terraform apply' and the infrastructure exists."
    exit 1
fi

echo "📍 Function App Name: $FUNCTION_APP_NAME"
cd ..

# Deploy to Azure
echo "🚀 Deploying to Azure Function App..."
npx func azure functionapp publish "$FUNCTION_APP_NAME" --javascript

# Success message
echo ""
echo "✅ Deployment completed successfully!"
echo "🌐 Function URL: https://$FUNCTION_APP_NAME.azurewebsites.net/api/textToSpeech"
echo ""
echo "💡 Test your function with:"
echo "curl -X POST https://$FUNCTION_APP_NAME.azurewebsites.net/api/textToSpeech \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"text\": \"Hello world, this is a test.\"}'"