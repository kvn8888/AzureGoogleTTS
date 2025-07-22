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

### Receive audio file
```bash
curl -X POST http://localhost:7071/api/textToSpeech \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from the cloud! This is a successful deployment."}' | \
  jq -r .audioData | \
  base64 --decode > tts.ogg
```

## Configuration

The function uses the following default settings:
- **Voice**: `en-US-Chirp3-HD-Aoede`
- **Language**: `en-US`
- **Audio Format**: `OGG_OPUS`
- **Batch Size**: 10 chunks processed simultaneously

These can be modified in the `textToSpeech.js` file as needed.

## Intelligent Text Processing

The function uses advanced Natural Language Processing (NLP) for optimal text chunking and audio quality.

### NLP-Based Sentence Detection

The system leverages **wink-nlp** with a trained English language model to provide sophisticated sentence boundary detection that goes far beyond simple period-splitting:

**Complex Cases Handled Correctly:**
- **Abbreviations**: "Dr. Smith works at St. Mary's Hospital." → (1 sentence)
- **Decimal Numbers**: "The price is $49.99 plus tax." → (1 sentence)
- **Multiple Punctuation**: "Really?! That's amazing!!!" → (2 sentences)
- **Initials**: "J.K. Rowling wrote Harry Potter." → (1 sentence)
- **URLs/Emails**: "Visit www.example.com for more info." → (1 sentence)

### Intelligent Chunking Strategy

1. **NLP Analysis**: Text is analyzed using a trained language model to identify proper sentence boundaries
2. **Sentence Grouping**: Multiple sentences are combined into chunks that stay under the Google TTS API limit (5000 characters)
3. **Quality Optimization**: Each chunk contains complete thoughts, never breaking sentences mid-stream for natural-sounding audio
4. **Fallback Protection**: Long sentences are gracefully split at word boundaries when necessary

### Benefits Over Simple Text Splitting

- **Higher Audio Quality**: Natural speech flow is preserved by respecting sentence boundaries
- **Linguistic Accuracy**: Handles complex punctuation, abbreviations, and edge cases correctly  
- **API Compliance**: Ensures all chunks stay within Google TTS character limits
- **Robust Processing**: Graceful handling of edge cases and unusual input patterns

This intelligent approach ensures that the generated audio sounds natural and professional, avoiding awkward pauses or cuts in the middle of sentences.

## Intelligent Rate Limiting & Batch Processing

The system automatically adapts its processing strategy based on the volume of text to handle large documents while respecting API quotas.

### Adaptive Processing Strategy

**Small Text (≤10 chunks):**
- Uses simple sequential processing
- Minimal delays between requests
- Fast processing for typical use cases

**Large Text (>10 chunks):**
- Switches to intelligent batch processing
- Respects Google Cloud TTS rate limits (default: 100 requests/minute with buffer)
- Processes chunks in controlled batches with staggered timing
- Implements exponential backoff for rate limit errors

### Rate Limiting Features

**Quota Management:**
- **Configurable Rate Limits**: Default 100 requests/minute (leaves headroom under typical 120/min quota)
- **Batch Processing**: Processes up to 10 concurrent requests per batch
- **Smart Delays**: Calculates optimal delays between requests to stay under limits
- **Progress Tracking**: Real-time progress updates for long-running operations

**Error Handling & Resilience:**
- **Automatic Retry**: Up to 3 retries per chunk with exponential backoff
- **Rate Limit Detection**: Intelligently detects and handles quota exceeded errors  
- **Partial Success**: Continues processing even if some chunks fail (up to 10% failure tolerance)
- **Graceful Degradation**: Returns partial results when possible

### Example: Processing 200 Chunks

For a large text resulting in 200 chunks with a 120/minute quota:

1. **Batching**: Processes in batches of 10 chunks
2. **Timing**: ~60 seconds per 100 chunks (with safety margin)  
3. **Duration**: ~2 minutes total processing time
4. **Resilience**: Automatic retries for any failed chunks
5. **Progress**: Real-time status updates throughout processing

This ensures reliable processing of large documents without hitting API limits or losing data.

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

5. **Get your function key (for secure access):**
   ```bash
   az functionapp keys list --name $(terraform -chdir=terraform output -raw function_app_name) --resource-group $(terraform -chdir=terraform output -raw resource_group_name) --query "functionKeys.default" -o tsv
   ```

## Using the Deployed API

### Get Audio File (Secure)
Replace `YOUR_FUNCTION_KEY` with the key from step 5 above:

```bash
curl -X POST "$(terraform -chdir=terraform output -raw function_app_api_url)" \
  -H "Content-Type: application/json" \
  -H "x-functions-key: YOUR_FUNCTION_KEY" \
  -d '{"text": "Hello from the cloud! This is a successful deployment."}' | \
  jq -r .audioData | \
  base64 --decode > tts.ogg
```

Or using query parameter:
```bash
curl -X POST "$(terraform -chdir=terraform output -raw function_app_api_url)?code=YOUR_FUNCTION_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from the cloud!"}' | \
  jq -r .audioData | \
  base64 --decode > tts.ogg
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

4. **Get your function key:**
   ```bash
   az functionapp keys list --name myTTSFunction --resource-group myResourceGroup --query "functionKeys.default" -o tsv
   ```

## Security

The function uses function-level authorization, which means:
- Each request must include a secret function key
- The function key can be passed as a header (`x-functions-key`) or query parameter (`code`)
- Keys can be retrieved using the Azure CLI or Azure Portal
- Using an unguessable function app name (with GUID) provides additional security through obscurity

## Error Handling

The function includes comprehensive error handling for:
- Missing or invalid input text
- Google Cloud authentication failures
- Text-to-Speech API errors
- Rate limiting and batch processing issues
