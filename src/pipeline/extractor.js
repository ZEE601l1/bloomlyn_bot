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
    const model = genAI.getGenerativeModel({ model: AI_MODELS.PRIMARY });
    
    const prompt = `
      Extract product details from the following vendor caption.
      Category: ${category}
      Caption: "${caption}"
      
      Return a JSON object with:
      - "name": Concise product name.
      - "price": The base numeric price in Naira (ignore currency symbols, just extract the number).
      - "description": A clean, formatted description without emojis or vendor contact info.
      
      CRITICAL INSTRUCTIONS:
      1. DO NOT confuse measurements (ml, oz, grams, kg) or quantities (pcs, set) with the price. For example, "50ml" is NOT a price of 50.
      2. If multiple prices are listed (e.g., "1 for 10k, 3 for 29400"), extract the single unit base price (e.g., 10000).
      3. Look for "N", "₦", "Price:", "P:", "K" (for 1000s) as clues.
      4. If the price is clearly present but written in a strange way, NORMALIZE IT. 0 should ONLY be returned if there is absolutely no price information.
      5. This is for a high-volume vendor; be AGGRESSIVE in locating the product price.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().replace(/```json|```/g, '').trim();
    const data = JSON.parse(text);

    return {
      name: data.name || 'Beautiful Product',
      vendor_price: parseFloat(data.price) || 0,
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
