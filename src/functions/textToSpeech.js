const { app } = require('@azure/functions');
const textToSpeech = require('@google-cloud/text-to-speech');
const { GoogleAuth } = require('google-auth-library');

// Initialize Google Cloud TTS client
let ttsClient;

async function initializeClient() {
    if (!ttsClient) {
        try {
            const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
            if (!credentialsJson) {
                throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable is not set');
            }

            const credentials = JSON.parse(credentialsJson);
            const auth = new GoogleAuth({
                credentials: credentials,
                scopes: ['https://www.googleapis.com/auth/cloud-platform']
            });

            ttsClient = new textToSpeech.TextToSpeechClient({ auth });
        } catch (error) {
            throw new Error(`Failed to initialize Google Cloud TTS client: ${error.message}`);
        }
    }
    return ttsClient;
}

function splitTextIntoChunks(text) {
    if (!text) return [];
    
    // Normalize line breaks
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Split on sentence endings and paragraph breaks
    const splitPattern = /(?<=[.!?])\s+|\n{2,}\s*/g;
    const potentialChunks = text.split(splitPattern);
    
    // Filter out empty chunks and trim whitespace
    const chunks = potentialChunks
        .map(chunk => chunk.trim())
        .filter(chunk => chunk.length > 0);
    
    return chunks;
}

async function synthesizeChunk(client, text, options = {}) {
    const request = {
        input: { text: text },
        voice: {
            languageCode: options.languageCode || 'en-US',
            name: options.voiceName || 'en-US-Chirp3-HD-Aoede'
        },
        audioConfig: {
            audioEncoding: options.audioEncoding || 'OGG_OPUS'
        }
    };

    try {
        const [response] = await client.synthesizeSpeech(request);
        return response.audioContent;
    } catch (error) {
        throw new Error(`TTS synthesis failed: ${error.message}`);
    }
}

async function combineAudioChunks(audioChunks) {
    // For now, just concatenate the binary data
    // In a production environment, you might want to use a proper audio library
    const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = Buffer.concat(audioChunks, totalLength);
    return combined;
}

app.http('textToSpeech', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log('Text-to-Speech function triggered');

        try {
            // Initialize TTS client
            const client = await initializeClient();

            // Parse request body
            const requestBody = await request.text();
            let inputText;

            try {
                const jsonBody = JSON.parse(requestBody);
                inputText = jsonBody.text;
            } catch {
                // If not JSON, treat as plain text
                inputText = requestBody;
            }

            if (!inputText || inputText.trim().length === 0) {
                return {
                    status: 400,
                    body: JSON.stringify({ error: 'No text provided' })
                };
            }

            // Split text into chunks
            const chunks = splitTextIntoChunks(inputText);
            context.log(`Split text into ${chunks.length} chunks`);

            // Synthesize each chunk
            const audioChunks = [];
            const batchSize = 10; // Process in batches to avoid rate limits
            
            for (let i = 0; i < chunks.length; i += batchSize) {
                const batch = chunks.slice(i, i + batchSize);
                const batchPromises = batch.map(chunk => synthesizeChunk(client, chunk));
                
                try {
                    const batchResults = await Promise.all(batchPromises);
                    audioChunks.push(...batchResults);
                } catch (error) {
                    context.log.error(`Batch ${Math.floor(i / batchSize)} failed:`, error.message);
                    throw error;
                }

                // Add delay between batches to respect rate limits
                if (i + batchSize < chunks.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // Combine audio chunks
            const finalAudio = await combineAudioChunks(audioChunks);

            // Return audio as base64 encoded response
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    success: true,
                    audioData: finalAudio.toString('base64'),
                    format: 'ogg',
                    chunksProcessed: chunks.length
                })
            };

        } catch (error) {
            context.log.error('Error in textToSpeech function:', error);
            
            return {
                status: 500,
                body: JSON.stringify({ 
                    error: 'Internal server error', 
                    message: error.message 
                })
            };
        }
    }
});