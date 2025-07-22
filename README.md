# Azure Google Text-to-Speech Function

A Node.js Azure Function that converts text to speech using Google Cloud Text-to-Speech API and returns audio files.

## Key Features

- **HTTP Trigger**: Accepts POST requests with text (JSON or plain text)
- **Google Cloud TTS**: Uses Google Cloud Text-to-Speech with configurable voices
- **Text Splitting**: Implements sentence-based splitting logic for optimal audio chunking
- **Rate Limiting**: Processes chunks in batches with delays to respect API limits
- **Audio Return**: Returns base64-encoded OGG audio that can be decoded and played

## Project Structure

```
├── package.json                    # Node.js dependencies
├── src/functions/textToSpeech.js   # Main function code
├── host.json                       # Azure Function configuration
├── local.settings.json             # Environment variables template
└── .gitignore                      # Standard ignore patterns
```

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Google Cloud credentials:**
   - Add your Google Cloud service account JSON to `GOOGLE_APPLICATION_CREDENTIALS_JSON` in `local.settings.json`
   - Ensure the service account has Text-to-Speech API permissions

3. **Test locally:**
   ```bash
   npm start
   ```
   
   Or alternatively:
   ```bash
   npx func start
   ```

## Usage

### Send Plain Text
```bash
curl -X POST http://localhost:7071/api/textToSpeech \
  -d "Hello world, this is a test of the text-to-speech function."
```

### Send JSON
```bash
curl -X POST http://localhost:7071/api/textToSpeech \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world, this is a test of the text-to-speech function."}'
```

### Response Format
```json
{
  "success": true,
  "audioData": "base64-encoded-audio-data",
  "format": "ogg",
  "chunksProcessed": 3
}
```

## Configuration

The function uses the following default settings:
- **Voice**: `en-US-Chirp3-HD-Aoede`
- **Language**: `en-US`
- **Audio Format**: `OGG_OPUS`
- **Batch Size**: 10 chunks processed simultaneously

These can be modified in the `textToSpeech.js` file as needed.

## Text Processing

The function automatically splits input text into chunks using:
- Sentence boundaries (periods, exclamation marks, question marks)
- Paragraph breaks (double newlines)
- Whitespace normalization and filtering

## Deployment

### Option 1: Terraform (Recommended)

1. **Install Terraform:** [Download from terraform.io](https://www.terraform.io/downloads)

2. **Configure Google credentials (choose one):**
   
   **Option A - Environment Variable (Recommended for CI/CD):**
   ```bash
   export TF_VAR_google_credentials_json='{"type":"service_account",...}'
   ```
   
   **Option B - .tfvars file (Recommended for local development):**
   ```bash
   cd terraform
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your Google credentials JSON
   ```

3. **Deploy infrastructure:**
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

4. **Deploy function code:**
   ```bash
   cd ..
   npx func azure functionapp publish $(terraform -chdir=terraform output -raw function_app_name)
   ```

### Option 2: Azure CLI

1. **Create Azure Function App:**
   ```bash
   az functionapp create \
     --resource-group myResourceGroup \
     --consumption-plan-location westus \
     --runtime node \
     --runtime-version 18 \
     --name myTTSFunction \
     --storage-account <storage-account-name>
   ```

2. **Deploy function code:**
   ```bash
   npx func azure functionapp publish myTTSFunction
   ```

3. **Set environment variables:**
   ```bash
   az functionapp config appsettings set \
     --name myTTSFunction \
     --resource-group myResourceGroup \
     --settings "GOOGLE_APPLICATION_CREDENTIALS_JSON=<your-json-credentials>"
   ```

## Error Handling

The function includes comprehensive error handling for:
- Missing or invalid input text
- Google Cloud authentication failures
- Text-to-Speech API errors
- Rate limiting and batch processing issues

## License

MIT