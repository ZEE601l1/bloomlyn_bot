import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config.js';
import AI_MODELS from './aiModels.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

/**
 * Classify a product based on its caption and/or image using Gemini AI.
 * @param {string} caption - The vendor's caption.
 * @param {Buffer} [imageBuffer] - Optional image buffer for multimodal analysis.
 * @returns {Promise<object|null>} - { category, description } or null if unsupported.
 */
export async function classifyProduct(caption, imageBuffer) {
  if (!caption) return null;



  try {
    const model = genAI.getGenerativeModel({ model: AI_MODELS.PRIMARY });

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
    const category = response.text().trim();
    console.log(`🤖 Text classification result: "${category}"`);
    
    let description = null;

    // If text-based classification returns "Other" or is unsure, try multimodal
    if ((!category || category === 'Other') && imageBuffer) {
      console.log('🖼️ Text classification inconclusive, trying multimodal...');
      const multimodalModel = genAI.getGenerativeModel({ model: AI_MODELS.MULTIMODAL });
      
      const parts = [
        { text: `Classify this product into one of: ${config.categories.join(', ')}. Return ONLY the category name or "Other".` },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageBuffer.toString('base64')
          }
        }
      ];

      const multimodalResult = await multimodalModel.generateContent({ contents: [{ role: 'user', parts }] });
      const multimodalResponse = await multimodalResult.response;
      const multimodalText = multimodalResponse.text().trim();
      console.log(`🖼️ Multimodal raw result: "${multimodalText}"`);
      
      // Multimodal prompt should return the category and a brief explanation
      for (const cat of config.categories) {
        if (multimodalText.toLowerCase().includes(cat.toLowerCase())) {
            return { category: cat, description: multimodalText };
        }
      }

      // If it's not a supported category, still return the description so the admin knows what it is
      return { category: 'Other', description: multimodalText };
    }

    if (category && !config.categories.includes(category)) {
      console.log(`⚠️ Rejected category "${category}" - not in supported list: ${config.categories.join(', ')}`);
      return { category: 'Other', description: `AI classified as "${category}" which is not in our supported categories.` };
    }

    return config.categories.includes(category) ? { category, description } : null;
  } catch (error) {
    console.error('❌ Classification failed:', error.message);
    
    // Traditional fallback to basic rule-based
    const lowerCaption = (caption || '').toLowerCase();

    if (/necklace|pendant|chain/i.test(lowerCaption)) return { category: 'Necklaces' };
    if (/bracelet|bangle/i.test(lowerCaption)) return { category: 'Bracelets' };
    if (/ring/i.test(lowerCaption)) return { category: 'Rings' };
    if (/perfume|oud|fragrance|pef|ml|oz|scent|edp|edt/i.test(lowerCaption)) return { category: 'Perfumes' };
    if (/bag|tote|handbag/i.test(lowerCaption)) return { category: 'Bags' };

    return null;
  }
}
