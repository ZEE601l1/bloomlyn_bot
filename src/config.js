import dotenv from 'dotenv';
dotenv.config();

const config = {
  // Telegram Bot
  botToken: process.env.BOT_TOKEN || '',
  adminTelegramId: parseInt(process.env.ADMIN_TELEGRAM_ID || '6022728957'),

  // Payment
  payment: {
    account: process.env.PAYMENT_ACCOUNT || '1507214019',
    bank: process.env.PAYMENT_BANK || 'Access Bank',
    name: process.env.PAYMENT_NAME || 'David Omolaye Abubakar',
  },

  // Scraper (GramJS)
  scraper: {
    apiId: parseInt(process.env.TELEGRAM_API_ID || '0'),
    apiHash: process.env.TELEGRAM_API_HASH || '',
    sessionString: process.env.TELEGRAM_SESSION_STRING || '',
    vendorChannels: (process.env.VENDOR_CHANNELS || '').split(',').filter(Boolean),
  },

  // Public Channel
  publicChannelId: process.env.PUBLIC_CHANNEL_ID || '@bloomlyn_store',

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
  },

  // Supported categories
  categories: ["Necklaces", "Bracelets", "Rings", "Perfumes", "Bags"],
};

export default config;
