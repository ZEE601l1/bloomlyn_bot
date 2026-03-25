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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' });
    
    const prompt = `
      Analyze the following product caption and classify it into exactly one of these categories:
      - Necklaces
      - Bracelets
      - Rings
      - Perfumes
      - Bags
      
      If the product does not fit any of these, return "Other".
      
      CONTEXT CLUES:
      - Perfumes often mention: ml, oz, EDP, EDT, Scent, Fragrance, or brands like Chanel, Dior, Gucci, Tom Ford, etc.
      - Jewelry (Necklaces, Bracelets, Rings) often mention: Gold, Silver, Zircon, Carat, Karat, pcs, or brands like Cartier, Van Cleef, Pandora.
      - Bags often mention: Leather, Tote, Handbag, Mini, or brands like LV, Chanel, Birkin, Prada.
      
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
    const lowerCaption = caption.toLowerCase();
    
    if (/necklace|pendant|chain/i.test(lowerCaption)) return 'Necklaces';
    if (/bracelet|bangle/i.test(lowerCaption)) return 'Bracelets';
    if (/ring/i.test(lowerCaption)) return 'Rings';
    if (/perfume|oud|fragrance|pef|ml|oz|scent|edp|edt/i.test(lowerCaption)) return 'Perfumes';
    if (/bag|tote|handbag/i.test(lowerCaption)) return 'Bags';
    
    return null;
  }
}
