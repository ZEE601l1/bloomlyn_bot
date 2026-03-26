/**
 * Bloomlyn Image Storage
 * Uploads images via the Telegram bot to get file_id for fast retrieval
 */

/**
 * Upload an image buffer via the bot to a private chat/channel to get file_id
 * @param {object} bot - node-telegram-bot-api instance
 * @param {Buffer} imageBuffer - Image data
 * @param {number} chatId - Admin chat ID (used as private upload target)
 * @returns {string|null} Telegram file_id or null on failure
 */
export async function uploadAndGetFileId(bot, imageBuffer, chatId) {
  try {
    const sentMessage = await bot.sendPhoto(chatId, imageBuffer, {
      caption: '📸 Bloomlyn image upload (auto)',
      disable_notification: true,
    }, {
      filename: 'product.jpg',
      contentType: 'image/jpeg'
    });

    if (sentMessage.photo && sentMessage.photo.length > 0) {
      // Get the highest quality version (last in array)
      const fileId = sentMessage.photo[sentMessage.photo.length - 1].file_id;

      // Delete the upload message to keep the chat clean
      try {
        await bot.deleteMessage(chatId, sentMessage.message_id);
      } catch {
        // Non-critical if deletion fails
      }

      return fileId;
    }

    return null;
  } catch (error) {
    console.error(`❌ Image upload failed: ${error.message}`);
    return null;
  }
}

export default { uploadAndGetFileId };
