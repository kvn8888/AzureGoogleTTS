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
