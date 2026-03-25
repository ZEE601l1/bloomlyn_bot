import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config.js';
import AI_MODELS from './aiModels.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

/**
 * Extract structured product data from a caption using Gemini AI.
 * @param {string} caption - The vendor's caption.
 * @param {string} category - The product category.
 * @returns {Promise<object>} - { name, price, description }
 */
export async function extractProductData(caption, category) {
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
    
    const prompt = `
      Extract product details from the following vendor caption.
      Category: ${category}
      Caption: "${caption}"
      
      CRITICAL INSTRUCTIONS:
      1. DO NOT confuse measurements (ml, oz, grams, kg) or quantities (pcs, set) with the price.
      2. If multiple prices are listed, extract the single unit base price.
      3. If the price is clearly present but written in a strange way, NORMALIZE IT.
    `;

    const result = await model.generateContent(prompt);
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
