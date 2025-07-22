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

function splitTextIntoChunks(text, maxLength = 4900) {
    if (!text) return [];
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    if (text.length <= maxLength) {
        return [text.trim()];
    }

    const chunks = [];
    let remainingText = text;

    while (remainingText.length > 0) {
        if (remainingText.length <= maxLength) {
            chunks.push(remainingText.trim());
            break;
        }

        let splitPos = -1;
        
        // Try to find a sentence-ending punctuation mark
        const sentenceDelimiters = ['.', '!', '?', '\n\n'];
        for (const delimiter of sentenceDelimiters) {
            const pos = remainingText.lastIndexOf(delimiter, maxLength);
            if (pos > splitPos) {
                splitPos = pos;
            }
        }

        // If no sentence end, find the last space
        if (splitPos === -1) {
            splitPos = remainingText.lastIndexOf(' ', maxLength);
        }

        // If no space, hard cut (worst case)
        if (splitPos === -1) {
            splitPos = maxLength;
        }
        
        // Adjust position to be after the delimiter
        splitPos += 1;

        chunks.push(remainingText.substring(0, splitPos).trim());
        remainingText = remainingText.substring(splitPos);
    }

    return chunks.filter(chunk => chunk.length > 0);
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

app.http('textToSpeech', {
    methods: ['POST'],
    authLevel: 'anonymous',
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
            for (const chunk of chunks) {
                const audioContent = await synthesizeChunk(client, chunk);
                audioChunks.push(audioContent);
                // Optional: add a small delay for very long texts with multiple chunks
                if (chunks.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            // Combine audio chunks
            const finalAudio = Buffer.concat(audioChunks);

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