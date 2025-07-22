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
# Text-to-Speech Frontend

A modern Next.js web interface for the Azure Text-to-Speech function with Google OAuth authentication.

## Features

- **Google OAuth Authentication** - Restricted to specific email address
- **Clean, responsive UI** built with Tailwind CSS
- **Real-time text-to-speech conversion**
- **Audio playback controls** with play/pause functionality
- **Download generated audio files** as OGG format
- **Error handling and loading states**
- **Flexible API key integration** (environment or manual entry)

## Quick Start

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment Variables
```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual values:
```bash
# Azure Function Configuration
NEXT_PUBLIC_API_URL=https://your-function-app.azurewebsites.net/api/textToSpeech
NEXT_PUBLIC_FUNCTION_KEY=your-function-key

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret
```

### 3. Set Up Google OAuth

#### Step 1: Create OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials" → "OAuth 2.0 Client ID"
3. Choose "Web application"
4. Add authorized origins and redirect URIs:

**For Local Development:**
- Authorized JavaScript origins: `http://localhost:3000`
- Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`

**For Production:**
- Authorized JavaScript origins: `https://your-vercel-app.vercel.app`
- Authorized redirect URIs: `https://your-vercel-app.vercel.app/api/auth/callback/google`

#### Step 2: Configure Authorized User
In `/pages/api/auth/[...nextauth].ts`, update the allowed email:
```typescript
const allowedEmail = 'your-email@gmail.com'  // Change this to your email
```

### 4. Generate NextAuth Secret
```bash
# Generate a secure random secret
openssl rand -base64 32

# Or use online generator: https://generate-secret.vercel.app/32
```

### 5. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment to Vercel

### Option 1: Vercel CLI (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```

3. **Add Environment Variables:**
   ```bash
   vercel env add GOOGLE_CLIENT_ID
   vercel env add GOOGLE_CLIENT_SECRET
   vercel env add NEXTAUTH_SECRET
   vercel env add NEXTAUTH_URL
   vercel env add NEXT_PUBLIC_API_URL
   vercel env add NEXT_PUBLIC_FUNCTION_KEY
   ```

4. **Redeploy with Environment Variables:**
   ```bash
   vercel --prod
   ```

### Option 2: Vercel Dashboard

1. **Connect Repository:**
   - Push code to GitHub
   - Import project in Vercel dashboard

2. **Add Environment Variables:**
   Go to Project Settings → Environment Variables and add:
   ```bash
   GOOGLE_CLIENT_ID=942539713880-...googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-...
   NEXTAUTH_URL=https://your-vercel-app.vercel.app
   NEXTAUTH_SECRET=your-generated-secret
   NEXT_PUBLIC_API_URL=https://your-function-app.azurewebsites.net/api/textToSpeech
   NEXT_PUBLIC_FUNCTION_KEY=your-function-key
   ```

3. **Update Google OAuth Settings:**
   - Add your Vercel URL to authorized origins
   - Add `https://your-vercel-app.vercel.app/api/auth/callback/google` to redirect URIs

4. **Deploy:**
   - Trigger a new deployment from the dashboard

## Getting Azure Function Details

### API URL
```bash
cd ../terraform
terraform output function_app_api_url
```

### Function Key
```bash
az functionapp keys list \
  --name $(terraform output -raw function_app_name) \
  --resource-group $(terraform output -raw resource_group_name) \
  --query "functionKeys.default" -o tsv
```

## Authentication Flow

1. **User visits app** → Redirected to sign-in if not authenticated
2. **Google OAuth** → User signs in with Google account
3. **Email validation** → System checks if email matches allowed user
4. **Access control** → 
   - ✅ **Authorized email**: Access granted to TTS interface
   - ❌ **Unauthorized email**: Access denied with error message

## Security Features

- **Email-based access control** - Only specified email can access
- **Secure OAuth flow** - No password management required
- **CSRF protection** - Built-in NextAuth security
- **Function key protection** - Azure Function requires authentication
- **Domain restrictions** - OAuth limited to authorized domains

## Usage

### Text Input Options
- **Plain text** - Type or paste any text
- **Character counter** - Real-time character count display
- **Text validation** - Ensures non-empty input

### API Key Options
1. **Environment Variable** (Recommended) - Set in `.env.local` or Vercel
2. **Manual Entry** - Override environment settings in the UI

### Audio Controls
- **Play/Pause** - Built-in audio player
- **Download** - Save OGG audio file locally
- **Regenerate** - Convert text again with new settings

## Troubleshooting

### Common Issues

**"Configuration Error"**
- Missing environment variables in production
- Check Vercel environment variables are set correctly

**"Access Denied"**
- Email not in allowedEmail list
- Update `/pages/api/auth/[...nextauth].ts` with correct email

**"OAuth Error"**
- Incorrect redirect URIs in Google Console
- Ensure production URL matches exactly

**"API Request Failed"**
- Function key incorrect or missing
- Azure Function may be down or misconfigured

### Debug Steps

1. **Check environment variables:**
   ```bash
   # Local development
   cat .env.local
   
   # Production
   vercel env ls
   ```

2. **Verify Google OAuth settings:**
   - Origins and redirect URIs match your domain
   - Client ID/Secret are correct

3. **Test Azure Function directly:**
   ```bash
   curl -X POST "https://your-function-app.azurewebsites.net/api/textToSpeech" \
     -H "Content-Type: application/json" \
     -H "x-functions-key: your-key" \
     -d '{"text": "test"}'
   ```

## Tech Stack

- **Next.js 14** - React framework with App Router
- **NextAuth.js** - Authentication with Google OAuth
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type safety and better DX
- **Lucide React** - Beautiful, customizable icons
- **Vercel** - Seamless deployment and hosting
