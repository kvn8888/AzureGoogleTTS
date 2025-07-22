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

/**
 * Synthesizes a single text chunk using Google Cloud TTS
 * 
 * @param {Object} client - Google Cloud TTS client
 * @param {string} text - Text to synthesize
 * @param {Object} options - Synthesis options (voice, language, format)
 * @returns {Promise<Buffer>} - Audio content as buffer
 */
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
        // Check if it's a rate limit error for intelligent handling
        if (error.code === 8 || error.message.includes('quota') || error.message.includes('rate')) {
            throw new RateLimitError(`Rate limit exceeded: ${error.message}`);
        }
        throw new Error(`TTS synthesis failed: ${error.message}`);
    }
}

/**
 * Custom error class for rate limit detection
 */
class RateLimitError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RateLimitError';
        this.isRateLimit = true;
    }
}

/**
 * Rate-limited batch processor for TTS synthesis
 * 
 * Intelligently handles large numbers of chunks while respecting API quotas:
 * - Processes chunks in controlled batches
 * - Implements exponential backoff for rate limiting
 * - Provides progress tracking for long operations
 * - Handles retry logic for failed chunks
 * 
 * @param {Object} client - Google Cloud TTS client
 * @param {string[]} chunks - Array of text chunks to synthesize
 * @param {Object} options - Processing options
 * @param {Function} progressCallback - Progress reporting callback
 * @returns {Promise<Buffer[]>} - Array of synthesized audio buffers
 */
async function processChunksWithRateLimit(client, chunks, options = {}, progressCallback = null) {
    const {
        maxConcurrent = 10,           // Max concurrent requests
        maxRequestsPerMinute = 120,   // API quota limit
        initialRetryDelay = 1000,     // Initial retry delay (1 second)
        maxRetries = 3                // Max retries per chunk
    } = options;

    // Calculate optimal batch timing to respect rate limits
    const batchSize = Math.min(maxConcurrent, maxRequestsPerMinute);
    const batchDelayMs = batchSize >= maxRequestsPerMinute ? 60000 : 0; // Wait full minute if hitting limit
    const requestDelayMs = Math.max(100, (60000 / maxRequestsPerMinute) * 1.1); // Add 10% buffer

    const results = new Array(chunks.length);
    const failedChunks = [];
    let processedCount = 0;
    
    // Report initial progress
    if (progressCallback) {
        progressCallback({
            processed: 0,
            total: chunks.length,
            status: 'Starting batch processing...',
            estimatedTimeMinutes: Math.ceil(chunks.length / maxRequestsPerMinute)
        });
    }

    // Process chunks in batches to respect rate limits
    for (let batchStart = 0; batchStart < chunks.length; batchStart += batchSize) {
        const batch = chunks.slice(batchStart, batchStart + batchSize);
        const batchPromises = [];

        // Create promises for current batch with staggered timing
        for (let i = 0; i < batch.length; i++) {
            const chunkIndex = batchStart + i;
            const chunk = batch[i];
            
            // Stagger requests within the batch to smooth out rate limiting
            const delay = i * requestDelayMs;
            
            const promise = new Promise(async (resolve) => {
                if (delay > 0) {
                    await new Promise(r => setTimeout(r, delay));
                }
                
                // Attempt synthesis with retry logic
                let lastError = null;
                for (let attempt = 0; attempt <= maxRetries; attempt++) {
                    try {
                        const audioContent = await synthesizeChunk(client, chunk, options);
                        resolve({ index: chunkIndex, success: true, data: audioContent });
                        return;
                    } catch (error) {
                        lastError = error;
                        
                        if (error.isRateLimit && attempt < maxRetries) {
                            // Exponential backoff for rate limit errors
                            const retryDelay = initialRetryDelay * Math.pow(2, attempt);
                            await new Promise(r => setTimeout(r, retryDelay));
                            continue;
                        }
                        break; // Exit retry loop on non-rate-limit errors or max retries reached
                    }
                }
                
                // All attempts failed
                resolve({ 
                    index: chunkIndex, 
                    success: false, 
                    error: lastError.message,
                    chunk: chunk
                });
            });
            
            batchPromises.push(promise);
        }

        // Wait for current batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Process batch results
        for (const result of batchResults) {
            if (result.success) {
                results[result.index] = result.data;
                processedCount++;
            } else {
                failedChunks.push({
                    index: result.index,
                    chunk: result.chunk,
                    error: result.error
                });
            }
        }

        // Report progress
        if (progressCallback) {
            const remainingBatches = Math.ceil((chunks.length - batchStart - batchSize) / batchSize);
            const estimatedRemainingMinutes = remainingBatches > 0 ? Math.ceil(remainingBatches * (batchDelayMs / 60000 + (batchSize * requestDelayMs) / 60000)) : 0;
            
            progressCallback({
                processed: processedCount,
                total: chunks.length,
                failed: failedChunks.length,
                status: `Processed batch ${Math.floor(batchStart / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`,
                estimatedRemainingMinutes
            });
        }

        // Wait between batches if we're near the rate limit
        if (batchStart + batchSize < chunks.length && batchDelayMs > 0) {
            if (progressCallback) {
                progressCallback({
                    processed: processedCount,
                    total: chunks.length,
                    failed: failedChunks.length,
                    status: `Rate limit cooldown: waiting ${batchDelayMs/1000}s before next batch...`,
                    estimatedRemainingMinutes: Math.ceil(batchDelayMs / 60000)
                });
            }
            await new Promise(resolve => setTimeout(resolve, batchDelayMs));
        }
    }

    // Handle any failed chunks
    if (failedChunks.length > 0) {
        const errorMessage = `Failed to process ${failedChunks.length}/${chunks.length} chunks`;
        if (progressCallback) {
            progressCallback({
                processed: processedCount,
                total: chunks.length,
                failed: failedChunks.length,
                status: errorMessage,
                failedChunks: failedChunks.map(f => ({ index: f.index, error: f.error }))
            });
        }
        
        // For now, throw an error if too many chunks failed
        // In production, you might want to return partial results
        if (failedChunks.length > chunks.length * 0.1) { // More than 10% failed
            throw new Error(`${errorMessage}. Errors: ${failedChunks.slice(0, 3).map(f => f.error).join(', ')}${failedChunks.length > 3 ? '...' : ''}`);
        }
    }

    // Fill in any missing results with empty buffers (for failed chunks that weren't too critical)
    for (let i = 0; i < results.length; i++) {
        if (!results[i]) {
            results[i] = Buffer.alloc(0); // Empty buffer for failed chunks
        }
    }

    return results;
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

            // Determine processing approach based on chunk count
            let audioChunks;
            if (chunks.length <= 10) {
                // Small number of chunks - use simple sequential processing
                context.log('Using simple sequential processing for small text');
                audioChunks = [];
                for (const chunk of chunks) {
                    const audioContent = await synthesizeChunk(client, chunk);
                    audioChunks.push(audioContent);
                    // Small delay between chunks
                    if (chunks.length > 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            } else {
                // Large number of chunks - use intelligent rate-limited batch processing
                context.log(`Using rate-limited batch processing for ${chunks.length} chunks`);
                
                // Progress callback for logging
                const progressCallback = (progress) => {
                    context.log(`TTS Progress: ${progress.processed}/${progress.total} chunks processed. Status: ${progress.status}`);
                    if (progress.estimatedRemainingMinutes > 0) {
                        context.log(`Estimated remaining time: ${progress.estimatedRemainingMinutes} minutes`);
                    }
                };

                // Configure rate limiting based on expected API quotas
                const batchOptions = {
                    maxConcurrent: 10,        // Conservative concurrent requests
                    maxRequestsPerMinute: 100, // Leave some headroom under 120/min quota
                    initialRetryDelay: 1000,
                    maxRetries: 3
                };

                audioChunks = await processChunksWithRateLimit(
                    client, 
                    chunks, 
                    batchOptions, 
                    progressCallback
                );
            }

            // Combine audio chunks into final audio
            const finalAudio = Buffer.concat(audioChunks.filter(chunk => chunk && chunk.length > 0));

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