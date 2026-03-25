import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

/**
 * Extract structured product data from a caption using Gemini AI.
 * @param {string} caption - The vendor's caption.
 * @param {string} category - The product category.
 * @returns {Promise<object>} - { name, price, description }
 */
export async function extractProductData(caption, category) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    
    const prompt = `
      Extract product details from the following vendor caption.
      Category: ${category}
      Caption: "${caption}"
      
      Return a JSON object with:
      - "name": Concise product name.
      - "price": The base numeric price in Naira (ignore currency symbols, just extract the number).
      - "description": A clean, formatted description without emojis or vendor contact info.
      
      If no price is found, return 0 for price.
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
    const priceMatch = caption.match(/(?:₦|NGN|N)?\s?(\d{1,3}(?:,\d{3})*)/);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
    
    return {
      name: caption.split('\n')[0].substring(0, 50),
      vendor_price: price,
      description: caption
    };
  }
}
