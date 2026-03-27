import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config.js';
import AI_MODELS from './aiModels.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

/**
 * Extract structured product data from a caption using Gemini AI.
 * @param {string} caption - The vendor's caption.
 * @param {string} category - The product category.
 * @param {Buffer} [imageBuffer] - Optional image buffer for multimodal analysis.
 * @returns {Promise<object>} - { name, price, description }
 */
export async function extractProductData(caption, category, imageBuffer) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: AI_MODELS.PRIMARY,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Concise product name" },
            price: { type: "number", description: "Base numeric price in Naira" },
            description: { type: "string", description: "Clean description without emojis or contact info" }
          },
          required: ["name", "price", "description"]
        }
      }
    });
    
    const parts = [
      { text: `
        Analyze this product image and vendor caption to extract structured details.
        
        CATEGORY: ${category}
        VENDOR CAPTION: "${caption}"
        
        CRITICAL RULES:
        1. REWRITE the description: Do NOT copy the vendor's caption. Instead, write a short, clean, and professional product description (1-2 sentences). Focus ONLY on the product details and features, without using overly "salesy" or persuasive marketing language. IMPORTANT: Ensure you preserve and naturally include any technical specs like volume (ml), weight, or sizing if they were mentioned in the original caption.
        2. NO EMOJIS OR DASHES: Do NOT use any emojis, em dashes (—), or special marketing symbols in the description. Use only standard punctuation (periods, commas).
        3. PRICE: Extract the base numeric price in Naira. Do NOT confuse price with measurements (ml, oz) or bulk offers (e.g., if it says "1 for 10k, 3 for 29k", the price is 10000).
        4. NO VENDOR INFO: Remove all phone numbers, social media handles, or vendor names from the description.
      ` }
    ];

    if (imageBuffer) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBuffer.toString('base64')
        }
      });
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    const data = JSON.parse(response.text());

    return {
      name: data.name || 'Beautiful Product',
      vendor_price: data.price || 0,
      description: data.description || caption.substring(0, 500)
    };
  } catch (error) {
    console.error('❌ Extraction failed:', error.message);
    // Fallback logic
    const priceMatch = caption.match(/(?:₦|NGN|N)?\s?(\d+(?:,\d{3})*)/);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
    
    return {
      name: caption.split('\n')[0].substring(0, 50),
      vendor_price: price,
      description: caption
    };
  }
}
