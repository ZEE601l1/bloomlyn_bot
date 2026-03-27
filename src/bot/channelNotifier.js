/**
 * Bloomlyn Channel Notifier
 * Auto-posts new/updated products to public Telegram channel
 */

import config from '../config.js';

/**
 * Post a product to the public Telegram channel
 * @param {object} bot - node-telegram-bot-api instance
 * @param {object} product - Product data with name, price, description, telegram_file_id
 * @returns {boolean} Success status
 */
export async function notifyChannel(bot, product) {
  const channelId = config.publicChannelId;
  if (!channelId) {
    console.log('⚠️  Public channel ID not set, skipping notification');
    return false;
  }

  try {
    const caption = formatProductCaption(product);
    const options = {
      caption,
      parse_mode: 'HTML'
    };

    let sentMessage;
    if (product.telegram_file_id) {
      sentMessage = await bot.sendPhoto(channelId, product.telegram_file_id, options);
    } else {
      // Send text-only if no image
      sentMessage = await bot.sendMessage(channelId, caption, {
        parse_mode: 'HTML'
      });
    }

    console.log(`📢 Posted to channel: ${product.name}`);
    return sentMessage;
  } catch (error) {
    console.error(`❌ Channel notification failed: ${error.message}`);
    return false;
  }
}

/**
 * Format a product caption for the channel post
 * @param {object} product - Product data
 * @returns {string} Formatted caption
 */
export function formatProductCaption(product) {
  const name = product.name || 'Beautiful Product';
  const desc = product.description || 'A premium piece from Bloomlyn';

  return (
    `<b>${name}</b>\n\n` +
    `${desc}\n\n` +
    `Get yours now @bloomlyn_bot`
  );
}

/**
 * Send a quick status update to the admin
 * @param {object} bot - Bot instance
 * @param {string} text - Status message
 */
export async function notifyAdminStatus(bot, text) {
  try {
    await bot.sendMessage(config.adminTelegramId, text, { parse_mode: 'HTML' });
  } catch (error) {
    console.error(`❌ Admin status notification failed: ${error.message}`);
  }
}

export async function notifyAdmin(bot, product) {
  try {
    const caption =
      `🔔 <b>New Product Scraped</b>\n\n` +
      `Name: ${product.name}\n` +
      `Category: ${product.category}\n` +
      `Vendor Price: ₦${(product.vendor_price || 0).toLocaleString()}\n` +
      `Selling Price: ₦${(product.selling_price || product.price || 0).toLocaleString()}\n` +
      `Description: ${product.description || 'N/A'}\n\n` +
      `Vendor: ${product.vendor_id || 'Unknown'}`;

    const options = {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: product.is_update ? '🔄 Approve Update' : '✅ Approve & Post', callback_data: `approve_product_${product.id}` },
            { text: '❌ Reject', callback_data: `reject_product_${product.id}` },
          ],
        ],
      },
    };

    if (product.telegram_file_id) {
      await bot.sendPhoto(config.adminTelegramId, product.telegram_file_id, {
        caption,
        ...options,
      });
    } else {
      await bot.sendMessage(config.adminTelegramId, caption, options);
    }
  } catch (error) {
    console.error(`❌ Admin notification failed: ${error.message}`);
  }
}

export default { notifyChannel, notifyAdmin, notifyAdminStatus };
