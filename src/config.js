import dotenv from 'dotenv';
dotenv.config();

const config = {
  // Telegram Bot
  botToken: process.env.BOT_TOKEN || '',
  adminTelegramId: parseInt(process.env.ADMIN_TELEGRAM_ID || '0'),

  // Payment
  payment: {
    account: process.env.PAYMENT_ACCOUNT || '',
    bank: process.env.PAYMENT_BANK || '',
    name: process.env.PAYMENT_NAME || '',
  },

  // Scraper (GramJS)
  scraper: {
    apiId: parseInt(process.env.TELEGRAM_API_ID || '0'),
    apiHash: process.env.TELEGRAM_API_HASH || '',
    sessionString: process.env.TELEGRAM_SESSION_STRING || '',
    vendorChannels: (process.env.VENDOR_CHANNELS || '').split(',').map(s => s.trim()).filter(Boolean),
  },

  // Public Channel
  publicChannelId: process.env.PUBLIC_CHANNEL_ID || '',

  // Firebase
  firebaseCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',

  // Gemini AI
  geminiApiKey: process.env.GEMINI_API_KEY || '',

  // Profit margins per category (in ₦)
  profitMargins: {
    bag: parseInt(process.env.PROFIT_BAG || '3000'),
    bracelet: parseInt(process.env.PROFIT_BRACELET || '1000'),
    necklace: parseInt(process.env.PROFIT_NECKLACE || '1000'),
    perfume: parseInt(process.env.PROFIT_PERFUME || '3000'),
    ring: parseInt(process.env.PROFIT_RING || '1000'),
  },

  // Supported categories
  categories: ["Necklaces", "Bracelets", "Rings", "Perfumes", "Bags"],
};

export default config;
