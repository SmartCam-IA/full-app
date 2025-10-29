/**
 * Fire Detection Analysis Module
 * Detects fire and smoke in images
 */

const axios = require('axios');
const config = require('../config');

class FireDetectionAnalysis {
    constructor() {
        this.name = 'Fire Detection';
        this.type = 'Pompier';
        this.endpoint =
            'https://router.huggingface.co/hf-inference/models/EdBianchi/vit-fire-detection';
    }

    /**
     * Analyze image for fire
     * @param {Buffer} imageBuffer - Image to analyze
     * @returns {Promise<Object>} - Analysis result with score and label
     */
    async analyze(imageBuffer) {
        try {
            // Check if API key is configured
            if (
                !config.huggingface.apiKey ||
                config.huggingface.apiKey === 'HUGGINGFACE_API_KEY'
            ) {
                const errorMsg =
                    'Hugging Face API key is not configured. Please set a valid HUGGINGFACE_API_KEY in docker-compose.yml';
                console.error(`[ERROR] Fire Detection: ${errorMsg}`);
                return {
                    label: 'error',
                    score: 0,
                    detected: false,
                    error: errorMsg,
                };
            }

            // Convert buffer to base64
            const base64Image = imageBuffer.toString('base64');

            const response = await axios.post(
                this.endpoint,
                { inputs: base64Image },
                {
                    headers: {
                        'Authorization': `Bearer ${config.huggingface.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 30000,
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity,
                }
            );

            if (Array.isArray(response.data) && response.data.length > 0) {
                // Find the result with highest score (most confident prediction)
                const topResult = response.data.reduce((max, current) =>
                    current.score > max.score ? current : max
                );

                // Check if it's fire or smoke
                const isFireOrSmoke =
                    topResult.label.toLowerCase().includes('fire') ||
                    topResult.label.toLowerCase().includes('smoke');

                return {
                    label: topResult.label,
                    score: isFireOrSmoke ? topResult.score : 0,
                    detected: isFireOrSmoke && topResult.score > 0.5,
                    allResults: response.data,
                };
            }

            return { label: 'no_fire', score: 0, detected: false };
        } catch (err) {
            let errorMsg = err.message;
            if (err.response) {
                errorMsg = `HTTP ${err.response.status}: ${
                    err.response.statusText || err.message
                }`;
                console.error(`[ERROR] Fire detection API failed: ${errorMsg}`);
                if (err.response.status === 401) {
                    errorMsg =
                        'Invalid or expired Hugging Face API key (401 Unauthorized)';
                } else if (err.response.data) {
                    console.error(`[ERROR] API response:`, err.response.data);
                }
            } else {
                console.error(`[ERROR] Fire detection failed: ${errorMsg}`);
            }
            return {
                label: 'error',
                score: 0,
                detected: false,
                error: errorMsg,
            };
        }
    }
}

module.exports = new FireDetectionAnalysis();
