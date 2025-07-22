# Text-to-Speech Frontend

A modern Next.js web interface for the Azure Text-to-Speech function.

## Features

- Clean, responsive UI built with Tailwind CSS
- Real-time text-to-speech conversion
- Audio playback controls
- Download generated audio files
- Error handling and loading states
- Secure API key integration

## Setup

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your Azure Function details:
   - `NEXT_PUBLIC_API_URL`: Your Azure Function URL
   - `NEXT_PUBLIC_FUNCTION_KEY`: Your Azure Function key

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Getting Your Azure Function Details

### API URL
From your terraform output:
```bash
cd ../terraform
terraform output function_app_api_url
```

### Function Key
```bash
az functionapp keys list --name $(terraform output -raw function_app_name) --resource-group $(terraform output -raw resource_group_name) --query "functionKeys.default" -o tsv
```

## Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Other Platforms
This is a standard Next.js app and can be deployed to any platform that supports Node.js.

## Tech Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
