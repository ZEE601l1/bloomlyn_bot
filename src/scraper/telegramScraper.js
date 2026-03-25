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

  console.log(`👁️  Listening to ${vendorChannels.length} vendor channel(s):`);
  vendorChannels.forEach(id => console.log(`   - ${id}`));

  client.addEventHandler(async (event) => {
    try {
      const message = event.message;
      if (!message) return;

      // Get the sender channel/chat
      const chatId = message.chatId?.toString() || message.peerId?.channelId?.toString();
      const isMonitored = vendorChannels.includes(chatId) || 
                          vendorChannels.includes(`-100${chatId}`) ||
                          (message.chat?.username && vendorChannels.includes(message.chat.username));

      if (!isMonitored) {
        // Verbose log for non-monitored channels if needed for debugging
        // console.log(`[Ignore] Message from ${chatId}`);
        return;
      }

      console.log(`📩 Received message from monitored channel ${chatId}`);

      if (!message.media) {
        console.log(`⏩ Skipping: No media in message from ${chatId}`);
        return;
      }

      // Check if message has a photo
      const isPhoto = message.media?.className === 'MessageMediaPhoto';
      if (!isPhoto) {
        console.log(`⏩ Skipping: Media is not a photo (type: ${message.media.className})`);
        return;
      }

      console.log(`📸 Processing photo post from ${chatId}`);

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

      console.log(`📝 Caption: ${productPost.caption.substring(0, 100).replace(/\n/g, ' ')}...`);
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
