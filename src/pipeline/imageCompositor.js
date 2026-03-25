/**
 * Bloomlyn AI Image Compositor
 * Uses Gemini API to place product images into clean, styled scenes
 * Critical rule: Product must remain exactly as-is, only repositioned/styled
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config.js';
import AI_MODELS from './aiModels.js';

let genAI;
let model;

const CATEGORY_PROMPTS = {
  bag: 'Place the exact bag from this image into a clean, professional product photo. Show a woman elegantly holding or carrying the bag. Use a soft, minimalist background with natural lighting. The bag must remain exactly as it appears - do not alter its design, color, or details. Focus on the bag as the centerpiece.',

  bracelet: 'Place the exact bracelet from this image onto a woman\'s wrist in an elegant pose. Use soft, warm lighting with a clean, minimal background. The bracelet must remain exactly as it appears - do not alter its design, stones, or materials. Show the bracelet clearly and beautifully.',

  necklace: 'Place the exact necklace from this image on a woman\'s neck, centered and clearly visible. Use a clean, elegant background with soft lighting. The necklace must remain exactly as it appears - do not alter its design, pendant, or chain. Make it the focal point of the image.',

  perfume: 'Place the exact perfume bottle from this image on a clean, luxurious surface with soft shadows and warm lighting. Add luxurious elements like marble, soft fabric, or gold accents. The bottle must remain exactly as it appears - do not alter its label, shape, or color. Highlight the premium nature of the fragrance.',

  ring: 'Place the exact ring from this image onto a woman\'s finger in an elegant pose. Use soft, warm lighting with a clean, minimal background. The ring must remain exactly as it appears - do not alter its design, stones, or material. Show the ring clearly and beautifully.',
};

/**
 * Initialize the Gemini AI client
 */
export function initCompositor() {
  if (!config.geminiApiKey) {
    console.log('⚠️  Gemini API key not set – AI compositing disabled');
    return false;
  }

  genAI = new GoogleGenerativeAI(config.geminiApiKey);
  model = genAI.getGenerativeModel({ model: AI_MODELS.MULTIMODAL });
  console.log('✅ Gemini AI compositor initialized');
  return true;
}

/**
 * Composite a product image into a styled scene
 * @param {Buffer} imageBuffer - Original vendor product image
 * @param {string} category - Product category (bag, bracelet, necklace, perfume)
 * @returns {Buffer|null} Composited image buffer or null on failure
 */
export async function compositeImage(imageBuffer, category) {
  if (!model) {
    console.log('⚠️  Compositor not initialized, returning original image');
    return null;
  }

  const prompt = CATEGORY_PROMPTS[category];
  if (!prompt) {
    console.log(`⚠️  No prompt for category: ${category}`);
    return null;
  }

  try {
    const base64Image = imageBuffer.toString('base64');

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image,
        },
      },
      prompt,
    ]);

    const response = result.response;

    // Check if the response contains an image
    if (response.candidates && response.candidates[0]) {
      const parts = response.candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          console.log(`✅ AI compositing successful for ${category}`);
          return Buffer.from(part.inlineData.data, 'base64');
        }
      }
    }

    console.log(`⚠️  AI compositing returned no image for ${category}, using original`);
    return null;
  } catch (error) {
    console.error(`❌ AI compositing failed for ${category}: ${error.message}`);
    return null;
  }
}

/**
 * Validate composited image (basic checks)
 * @param {Buffer} compositedBuffer - AI-generated image
 * @param {Buffer} originalBuffer - Original vendor image
 * @returns {boolean} Whether the composited image passes validation
 */
export function validateImage(compositedBuffer, originalBuffer) {
  if (!compositedBuffer) return false;

  // Basic size check: composited image should be reasonable
  if (compositedBuffer.length < 1000) return false;

  // Image should not be too much larger or smaller than original
  const ratio = compositedBuffer.length / originalBuffer.length;
  if (ratio < 0.1 || ratio > 20) return false;

  return true;
}

export default { initCompositor, compositeImage, validateImage };
