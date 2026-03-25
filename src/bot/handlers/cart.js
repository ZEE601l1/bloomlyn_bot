import { getOrCreateUser, updateCart, getProductById } from '../../db/firestore.js';

export default function registerCart(bot) {
  const showCart = async (chatId, userId, messageId = null) => {
    try {
      const user = await getOrCreateUser(userId);
      const cart = user.cart || [];

      if (cart.length === 0) {
        const message = "Your cart is empty";
        const opts = {
            reply_markup: {
              inline_keyboard: [[{ text: "🛍️ Browse Products", callback_data: "browse" }]]
            }
          };
        if (messageId) {
            await bot.editMessageText(message, { chat_id: chatId, message_id: messageId, ...opts });
        } else {
            await bot.sendMessage(chatId, message, opts);
        }
        return;
      }

      let message = "🛒 Your Bloomlyn Cart\n\n";
      let total = 0;

      for (let i = 0; i < cart.length; i++) {
        const item = cart[i];
        if (!item.product_id) continue;

        const product = await getProductById(item.product_id);
        if (product) {
          const price = product.selling_price || product.price || 0;
          const itemTotal = price * item.quantity;
          message += `${i + 1}. <b>${product.name}</b>\n`;
          message += `   ₦${price.toLocaleString()} × ${item.quantity} = ₦${itemTotal.toLocaleString()}\n\n`;
          total += itemTotal;
        }
      }

      message += `Subtotal: ₦${total.toLocaleString()}\n`;
      message += "Delivery: FREE\n";
      message += `Total: ₦${total.toLocaleString()}`;

      const opts = {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Checkout", callback_data: "checkout" }],
            [
              { text: "🗑️ Clear Cart", callback_data: "clear_cart" },
              { text: "🛍️ Continue Shopping", callback_data: "browse" }
            ]
          ]
        }
      };

      if (messageId) {
        try {
          await bot.editMessageText(message, { chat_id: chatId, message_id: messageId, ...opts });
        } catch (e) {
          // If editing fails (e.g. current message is a photo), delete and send new
          await bot.deleteMessage(chatId, messageId).catch(() => {});
          await bot.sendMessage(chatId, message, opts);
        }
      } else {
        await bot.sendMessage(chatId, message, opts);
      }
    } catch (error) {
      console.error('❌ Error in showCart:', error.message);
    }
  };

  bot.on('message', async (msg) => {
    if (msg.text === '🛒 My Cart') {
      await showCart(msg.chat.id, msg.from.id);
    }
  });

  bot.on('callback_query', async (query) => {
    try {
      const chatId = query.message.chat.id;
      const userId = query.from.id;

      if (query.data === 'view_cart') {
        await bot.answerCallbackQuery(query.id);
        await showCart(chatId, userId, query.message.message_id);
      } else if (query.data === 'clear_cart') {
        await updateCart(userId, []);
        await bot.answerCallbackQuery(query.id, { text: "Your cart has been cleared" });
        await showCart(chatId, userId, query.message.message_id);
      }
    } catch (error) {
      console.error('❌ Error in cart callback:', error.message);
      bot.answerCallbackQuery(query.id, { text: 'An error occurred.' });
    }
  });
}
