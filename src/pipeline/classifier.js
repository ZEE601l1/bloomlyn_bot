import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

/**
 * Classify a product based on its caption using Gemini AI.
 * @param {string} caption - The vendor's caption.
 * @returns {Promise<string|null>} - The category or null if unsupported.
 */
export async function classifyProduct(caption) {
  if (!caption) return null;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `
      Analyze the following product caption and classify it into exactly one of these categories:
      - Necklaces
      - Bracelets
      - Rings
      - Perfumes
      - Bags
      
      If the product does not fit any of these, return "Other".
      Only return the category name, nothing else.
      
      Caption: "${caption}"
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const category = response.text().trim();

    return config.categories.includes(category) ? category : null;
  } catch (error) {
    console.error('❌ Classification failed:', error.message);
    // Fallback to basic rule-based for mission stability if AI fails
    if (/necklace|pendant|chain/i.test(caption)) return 'Necklaces';
    if (/bracelet|bangle/i.test(caption)) return 'Bracelets';
    if (/ring/i.test(caption)) return 'Rings';
    if (/perfume|oud|fragrance|pef/i.test(caption)) return 'Perfumes';
    if (/bag|tote|handbag/i.test(caption)) return 'Bags';
    return null;
  }
}
