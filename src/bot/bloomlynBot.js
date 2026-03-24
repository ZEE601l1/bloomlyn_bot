import TelegramBot from 'node-telegram-bot-api';
import config from '../config.js';

// Import handlers
import registerStart from './handlers/start.js';
import registerBrowse from './handlers/browse.js';
import registerCart from './handlers/cart.js';
import registerCheckout from './handlers/checkout.js';
import registerOrders from './handlers/orders.js';
import registerAdmin from './handlers/admin.js';

export function initBot() {
  const bot = new TelegramBot(config.botToken, { polling: true });

  // Register all handlers
  registerStart(bot);
  registerBrowse(bot);
  registerCart(bot);
  registerCheckout(bot);
  registerOrders(bot);
  registerAdmin(bot);

  console.log('🚀 Bloomlyn Bot is running...');
  return bot;
}
