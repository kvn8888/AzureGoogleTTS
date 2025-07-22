const { app } = require('@azure/functions');
const textToSpeech = require('@google-cloud/text-to-speech');
const { GoogleAuth } = require('google-auth-library');

// NLP dependencies for intelligent text parsing
const winkNLP = require('wink-nlp');
const model = require('wink-eng-lite-web-model');

// Initialize NLP processor with English language model
// This gives us sophisticated sentence boundary detection that handles:
// - Abbreviations (Dr., U.S.A., etc.)
// - Decimal numbers ($49.99, 3.14, etc.) 
// - Complex punctuation patterns
const nlp = winkNLP(model);

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

/**
 * Uses advanced NLP to intelligently split plain text into sentence-based chunks
 * 
 * This function leverages the wink-nlp library with a trained English language model
 * to provide sophisticated sentence boundary detection that handles complex cases:
 * 
 * Examples that are correctly handled:
 * - Abbreviations: "Dr. Smith works at St. Mary's Hospital." (1 sentence)
 * - Decimal numbers: "The price is $49.99 plus tax." (1 sentence) 
 * - Multiple punctuation: "Really?! That's amazing!!!" (2 sentences)
 * - Initials: "J.K. Rowling wrote Harry Potter." (1 sentence)
 * - URLs and emails: "Visit www.example.com for more info." (1 sentence)
 * 
 * @param {string} plainText - The plain text to chunk into sentences
 * @returns {string[]} - Array of sentence chunks
 */
function extractSentencesWithNLP(plainText) {
    // Input validation
    if (!plainText || typeof plainText !== 'string') {
        return [];
    }
    
    // Feed the text into the NLP engine for analysis
    // The engine tokenizes, parses, and annotates the text using the language model
    // This is equivalent to the original: nlp.readDoc(this).sentences().out('array')
    const doc = nlp.readDoc(plainText);
    
    // Extract sentences using sophisticated boundary detection
    // This goes far beyond simple period-splitting and understands context
    const sentences = doc.sentences().out('array');
    
    // Filter out any empty sentences (edge case protection)
    return sentences.filter(sentence => sentence.trim().length > 0);
}

/**
 * Main text chunking function that creates optimal chunks for TTS processing
 * 
 * This function implements the intelligent chunking strategy described in the documentation:
 * 1. Uses NLP to extract proper sentences (handling abbreviations, decimals, etc.)
 * 2. Groups sentences together into chunks that don't exceed the API limit
 * 3. Prioritizes natural speech boundaries for better audio quality
 * 
 * The approach ensures that:
 * - Sentences are never broken in the middle (preserves speech flow)
 * - Chunks stay under Google TTS API limit (5000 characters)
 * - Each chunk contains complete thoughts for natural-sounding audio
 * 
 * @param {string} text - Input plain text to be chunked
 * @param {number} maxLength - Maximum characters per chunk (default: 4900, leaving buffer for API)
 * @returns {string[]} - Array of intelligently chunked text segments
 */
function intelligentTextChunking(text, maxLength = 4900) {
    // Input validation and normalization
    if (!text || typeof text !== 'string') {
        return [];
    }
    
    // Normalize line endings for consistent processing
    // Convert Windows (\r\n) and Mac (\r) line endings to Unix (\n)
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    
    // If text is short enough, return as-is (optimization)
    if (normalizedText.length <= maxLength) {
        return [normalizedText];
    }
    
    // Use NLP-based sentence extraction for optimal speech quality
    // This is the core of the intelligent chunking - we get proper sentences
    const sentences = extractSentencesWithNLP(normalizedText);
    
    // If no sentences were detected (edge case), fall back to simple chunking
    if (sentences.length === 0) {
        return [normalizedText];
    }
    
    // If we only got one sentence but it's too long, we need to split it
    if (sentences.length === 1 && sentences[0].length > maxLength) {
        // Last resort: split long sentence at word boundaries
        return splitLongTextAtWordBoundaries(sentences[0], maxLength);
    }
    
    // Group sentences into chunks that don't exceed length limit
    // This creates longer, more natural-sounding audio segments while respecting API limits
    const chunks = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
        // Check if adding this sentence would exceed the limit
        const testChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
        
        if (testChunk.length > maxLength) {
            // Save current chunk if it has content
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                // Start new chunk with current sentence
                currentChunk = sentence;
            } else {
                // Single sentence is too long - split it at word boundaries
                const sentenceChunks = splitLongTextAtWordBoundaries(sentence, maxLength);
                chunks.push(...sentenceChunks);
                currentChunk = '';
            }
        } else {
            // Sentence fits, add it to current chunk
            currentChunk = testChunk;
        }
    }
    
    // Don't forget the final chunk
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }
    
    return chunks.filter(chunk => chunk.length > 0);
}

/**
 * Fallback function to split text at word boundaries when sentences are too long
 * 
 * This is used as a last resort when even individual sentences exceed the API limit.
 * It attempts to split at natural word boundaries while staying under the limit.
 * 
 * @param {string} text - The text to split
 * @param {number} maxLength - Maximum length per chunk
 * @returns {string[]} - Array of text chunks split at word boundaries
 */
function splitLongTextAtWordBoundaries(text, maxLength) {
    const chunks = [];
    let remainingText = text;
    
    while (remainingText.length > maxLength) {
        // Find the last space within the length limit
        let splitPos = remainingText.lastIndexOf(' ', maxLength);
        
        // If no space found, split at the limit (hard break)
        if (splitPos === -1) {
            splitPos = maxLength;
        }
        
        chunks.push(remainingText.substring(0, splitPos).trim());
        remainingText = remainingText.substring(splitPos).trim();
    }
    
    // Add the remaining text
    if (remainingText.length > 0) {
        chunks.push(remainingText);
    }
    
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

            // Use intelligent NLP-based text chunking for optimal speech quality
            // This will properly handle sentence boundaries, abbreviations, and complex punctuation
            const chunks = intelligentTextChunking(inputText);
            context.log(`Intelligently chunked text into ${chunks.length} sentence-based segments`);

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