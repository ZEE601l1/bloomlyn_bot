/**
 * Bloomlyn Telegram Scraper
 * Uses GramJS to listen to vendor channels and extract product posts
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import config from '../config.js';

let client;

/**
 * Initialize the GramJS scraper client
 * @returns {TelegramClient} The connected client
 */
export async function initScraper() {
  if (!config.scraper.apiId || !config.scraper.apiHash) {
    console.log('⚠️  Scraper credentials not set – scraper disabled');
    return null;
  }

  const session = new StringSession(config.scraper.sessionString || '');

  client = new TelegramClient(session, config.scraper.apiId, config.scraper.apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => {
      // This will prompt in console during first auth
      const readline = await import('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      return new Promise((resolve) => rl.question('Enter your phone number: ', resolve));
    },
    password: async () => {
      const readline = await import('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      return new Promise((resolve) => rl.question('Enter your 2FA password: ', resolve));
    },
    phoneCode: async () => {
      const readline = await import('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      return new Promise((resolve) => rl.question('Enter the code you received: ', resolve));
    },
    onError: (err) => console.error('Scraper auth error:', err),
  });

  // Save the session string for future use
  const savedSession = client.session.save();
  console.log('✅ GramJS scraper connected');
  console.log(`📋 Session string (save this in .env): ${savedSession}`);

  return client;
}

/**
 * Start listening for new messages from vendor channels
 * @param {Function} onNewProduct - Callback with extracted data: { caption, imageBuffer, vendorId, timestamp }
 */
export async function startListening(onNewProduct) {
  if (!client) {
    console.log('⚠️  Scraper not initialized');
    return;
  }

  const vendorChannels = config.scraper.vendorChannels;
  if (!vendorChannels.length) {
    console.log('⚠️  No vendor channels configured');
    return;
  }

  console.log(`👁️  Listening to ${vendorChannels.length} vendor channel(s)...`);

  client.addEventHandler(async (event) => {
    try {
      const message = event.message;
      if (!message || !message.media) return; // Skip messages without media

      // Check if message has a photo
      const isPhoto = message.media?.className === 'MessageMediaPhoto';
      if (!isPhoto) return;

      // Get the sender channel/chat
      const chatId = message.chatId?.toString() || message.peerId?.channelId?.toString();

      // Check if this is from a monitored vendor channel
      if (!vendorChannels.includes(chatId) && !vendorChannels.includes(`-100${chatId}`)) {
        return;
      }

      console.log(`📸 New vendor post from channel ${chatId}`);

      // Download the image
      const imageBuffer = await client.downloadMedia(message.media);

      if (!imageBuffer) {
        console.log('⚠️  Could not download image, skipping');
        return;
      }

      // Extract data and pass to pipeline
      const productPost = {
        caption: message.text || message.message || '',
        imageBuffer,
        vendorId: chatId,
        timestamp: new Date(message.date * 1000).toISOString(),
      };

      console.log(`📝 Caption: ${productPost.caption.slice(0, 80)}...`);
      await onNewProduct(productPost);
    } catch (error) {
      console.error('❌ Error processing vendor message:', error.message);
    }
  }, new NewMessage({ chats: vendorChannels.map((c) => (isNaN(c) ? c : parseInt(c))) }));
}

/**
 * Get the client for manual use
 */
export function getClient() {
  return client;
}

export default { initScraper, startListening, getClient };
