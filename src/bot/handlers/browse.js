import { getProductsByCategory, getOrCreateUser, updateCart, getDb } from '../../db/firestore.js';
import config from '../../config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory session to track user browsing state
// In a large production app, this would be in Redis or Firestore
const userSessions = new Map();

export default function registerBrowse(bot) {
  // Main browse command (triggered by button or text)
  const handleBrowse = async (chatId, messageId = null) => {
    const categories = config.categories;
    const keyboard = [];
    for (let i = 0; i < categories.length; i += 2) {
      const row = [{ text: categories[i], callback_data: `category_${categories[i]}` }];
      if (i + 1 < categories.length) {
        row.push({ text: categories[i + 1], callback_data: `category_${categories[i + 1]}` });
      }
      keyboard.push(row);
    }
    keyboard.push([{ text: "🔙 Back to Menu", callback_data: "start" }]);

    const message = "Here's our available products";
    const opts = { reply_markup: { inline_keyboard: keyboard } };

    if (messageId) {
      await bot.editMessageText(message, { chat_id: chatId, message_id: messageId, ...opts }).catch(() => {
        // Fallback if edit fails (e.g. if it was a photo message)
         bot.sendMessage(chatId, message, opts);
      });
    } else {
      await bot.sendMessage(chatId, message, opts);
    }
  };

  bot.on('message', async (msg) => {
    if (msg.text === '🛍️ Browse Categories' || msg.text === 'Browse Collections') {
      await handleBrowse(msg.chat.id);
    }
  });

  bot.on('callback_query', async (query) => {
    try {
      const chatId = query.message.chat.id;
      const data = query.data;

      if (data === 'browse') {
        await bot.answerCallbackQuery(query.id);
        await handleBrowse(chatId, query.message.message_id);
        return;
      }

      if (data.startsWith('category_')) {
        await bot.answerCallbackQuery(query.id);
        const category = data.replace('category_', '');
        
        await bot.editMessageText(`⏳ Loading ${category}...`, {
          chat_id: chatId,
          message_id: query.message.message_id
        });

        const products = await getProductsByCategory(category);

        if (!products || products.length === 0) {
          return bot.editMessageText(`No ${category} available right now.\nWe're restocking soon!`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
              inline_keyboard: [[{ text: "Back", callback_data: "browse" }]]
            }
          });
        }

        // Initialize session for this user
        userSessions.set(chatId, {
          category,
          products,
          index: 0,
          quantities: {} // productId -> quantity
        });

        await showProduct(bot, chatId, query.message.message_id);
      }

      if (data.startsWith('nav_')) {
        await bot.answerCallbackQuery(query.id);
        const session = userSessions.get(chatId);
        if (!session) return;

        const direction = data.replace('nav_', '');
        if (direction === 'next' && session.index < session.products.length - 1) {
          session.index++;
        } else if (direction === 'prev' && session.index > 0) {
          session.index--;
        }

        await showProduct(bot, chatId, query.message.message_id);
      }

      if (data.startsWith('qty_')) {
        await bot.answerCallbackQuery(query.id);
        const session = userSessions.get(chatId);
        if (!session) return;

        const [action, productId] = data.replace('qty_', '').split('_');
        const currentQty = session.quantities[productId] || 1;

        if (action === 'increase' && currentQty < 10) {
          session.quantities[productId] = currentQty + 1;
        } else if (action === 'decrease' && currentQty > 1) {
          session.quantities[productId] = currentQty - 1;
        }

        await showProduct(bot, chatId, query.message.message_id);
      }

      if (data.startsWith('add_cart_')) {
        const productId = data.replace('add_cart_', '');
        const session = userSessions.get(chatId);
        const quantity = session?.quantities[productId] || 1;
        
        // Find product name for the notification
        const product = session?.products.find(p => p.id === productId);
        const productName = product?.name || 'Item';

        const user = await getOrCreateUser(query.from.id, query.from);
        const cart = user.cart || [];
        
        const existing = cart.find(item => item.product_id === productId);
        let alertText = "";
        if (existing) {
          existing.quantity += quantity;
          alertText = `🔄 UPDATED ${productName} quantity to ${existing.quantity}!`;
        } else {
          cart.push({ product_id: productId, quantity: quantity });
          alertText = `✅ ADDED ${quantity} ${productName} to cart!`;
        }
        
        await updateCart(user.id, cart);
        
        // Reset quantity for this product in session
        if (session) session.quantities[productId] = 1;

        // Show a quick alert at the top of the screen
        await bot.answerCallbackQuery(query.id, { text: alertText });
        
        const cartMessage = `<b>✅ ${alertText}</b>\n\nYou currently have ${cart.length} unique items in your cart.`;
        
        // Detect if it's a photo message or text message
        const isPhoto = !!(query.message.photo || query.message.caption);
        
        const opts = {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: "🛒 View Cart", callback_data: "view_cart" }],
              [{ text: "🛍️ Continue Shopping", callback_data: session?.category ? `category_${session.category}` : "browse" }]
            ]
          }
        };

        if (isPhoto) {
          await bot.editMessageCaption(cartMessage, opts).catch(e => {
            console.error('❌ Error editing caption:', e.message);
          });
        } else {
          await bot.editMessageText(cartMessage, opts).catch(e => {
            console.error('❌ Error editing text:', e.message);
          });
        }
      }

      if (data === 'no_op') {
        await bot.answerCallbackQuery(query.id);
      }

    } catch (error) {
      console.error('❌ Error in browse callback handler:', error.message);
      bot.answerCallbackQuery(query.id, { text: 'An error occurred.' });
    }
  });
}

async function showProduct(bot, chatId, messageId) {
  const session = userSessions.get(chatId);
  if (!session) return;

  const product = session.products[session.index];
  const quantity = session.quantities[product.id] || 1;
  const price = product.selling_price || product.price || 0;
  const total = price * quantity;

  const caption = `<b>${product.name}</b>\n` +
    `₦${price.toLocaleString()}\n\n` +
    `${product.description || 'A beautiful piece for you'}\n\n` +
    `<b>Quantity:</b> ${quantity}\n` +
    `<b>Total:</b> ₦${total.toLocaleString()}`;

  const keyboard = [
    [
      { text: "➖", callback_data: `qty_decrease_${product.id}` },
      { text: `${quantity}`, callback_data: `no_op` },
      { text: "➕", callback_data: `qty_increase_${product.id}` }
    ],
    [{ text: "🛒 Add to Cart", callback_data: `add_cart_${product.id}` }]
  ];

  const navButtons = [];
  if (session.index > 0) {
    navButtons.push({ text: "⬅️ Previous", callback_data: "nav_prev" });
  }
  navButtons.push({ text: `${session.index + 1}/${session.products.length}`, callback_data: "no_op" });
  if (session.index < session.products.length - 1) {
    navButtons.push({ text: "Next ➡️", callback_data: "nav_next" });
  }
  keyboard.push(navButtons);

  keyboard.push([
    { text: "More Products", callback_data: "browse" },
    { text: "View Cart", callback_data: "view_cart" }
  ]);

  const opts = {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: keyboard },
    parse_mode: 'HTML'
  };

  try {
    let telegramFileId = product.telegram_file_id;

    // --- LAZY UPLOAD LOGIC ---
    if (!telegramFileId && product.image_path) {
      const fullPath = path.resolve(__dirname, '../../../', product.image_path);
      if (fs.existsSync(fullPath)) {
        try {
          // Send temporary loading message if we're uploading a fresh image
          await bot.editMessageText(`📸 <b>UPLOADING PRODUCT IMAGE...</b>`, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML'
          }).catch(() => {});

          const sentMsg = await bot.sendPhoto(chatId, fs.createReadStream(fullPath), {
            caption: caption,
            reply_markup: { inline_keyboard: keyboard },
            parse_mode: 'HTML'
          }, {
            filename: path.basename(fullPath),
            contentType: 'image/jpeg'
          });

          telegramFileId = sentMsg.photo[sentMsg.photo.length - 1].file_id;

          // Save file_id to Firestore so we don't upload again
          await getDb().collection('bloomlyn_products').doc(product.id).update({
            telegram_file_id: telegramFileId
          });

          // Delete the old message (which was either "Here's products" or "Uploading...")
          await bot.deleteMessage(chatId, messageId).catch(() => {});
          return; // Already sent the photo, so we're done
        } catch (uploadErr) {
          console.error('❌ Lazy upload failed:', uploadErr.message);
        }
      }
    }

    const isPhoto = !!telegramFileId;

    if (isPhoto) {
      // Try to edit the media of the current message
      try {
        await bot.editMessageMedia({
          type: 'photo',
          media: telegramFileId,
          caption: caption,
          parse_mode: 'HTML'
        }, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: { inline_keyboard: keyboard }
        });
      } catch (e) {
        // If editing media fails (e.g. it wasn't a photo message before), 
        // delete and send new photo message
        await bot.deleteMessage(chatId, messageId).catch(() => {});
        await bot.sendPhoto(chatId, telegramFileId, {
          caption: caption,
          reply_markup: { inline_keyboard: keyboard },
          parse_mode: 'HTML'
        });
      }
    } else {
      // If it's a text-only product (rare), edit message text
      await bot.editMessageText(caption, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: keyboard },
        parse_mode: 'HTML'
      });
    }
  } catch (err) {
    console.error('❌ Error showing product:', err.message);
  }
}
