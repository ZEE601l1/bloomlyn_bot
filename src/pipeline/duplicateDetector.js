import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config.js';
import { getProductsByCategory } from '../db/firestore.js';
import AI_MODELS from './aiModels.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

/**
 * Detect if a product is a duplicate using Gemini AI.
 * @param {object} newProduct - { name, description, category }
 * @returns {Promise<object|null>} - Existing product if duplicate, else null.
 */
export async function findDuplicate(newProduct) {
  try {
    const existingProducts = await getProductsByCategory(newProduct.category);
    if (existingProducts.length === 0) return null;

    // Filter to a manageable list of candidates (top 20 most recent)
    const candidates = existingProducts.slice(0, 20);

    const model = genAI.getGenerativeModel({ model: AI_MODELS.PRIMARY });
    
    const prompt = `
      You are a duplicate detection system for a shopping bot.
      New Product:
      Name: ${newProduct.name}
      Description: ${newProduct.description}
      
      Candidates:
      ${candidates.map((p, i) => `${i + 1}. ID: ${p.id}, Name: ${p.name}`).join('\n')}
      
      Does the new product match any of the candidates exactly or very closely (same model, brand, type)?
      If YES, return the ID of the matching candidate.
      If NO, return "NONE".
      Only return the result, nothing else.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const match = response.text().trim();

    if (match === 'NONE') return null;
    
    return existingProducts.find(p => p.id === match) || null;
  } catch (error) {
    console.error('❌ Duplicate detection failed:', error.message);
    // Fallback: simple name normalization check
    const normalizedNew = newProduct.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const existing = await getProductsByCategory(newProduct.category);
    return existing.find(p => {
        const norm = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return norm === normalizedNew;
    }) || null;
  }
}
