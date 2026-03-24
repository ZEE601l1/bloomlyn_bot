import { getOrCreateUser, getOrdersByUserId, getOrderById, getOrdersByPhone } from '../../db/firestore.js';

const orderTrackingSessions = new Set(); // chatIds awaiting tracking input

export default function registerOrders(bot) {
  const showMyOrders = async (chatId, userId, messageId = null) => {
    try {
      const orders = await getOrdersByUserId(userId);
      if (orders.length === 0) {
        const message = "You haven't placed any orders yet";
        const opts = { reply_markup: { inline_keyboard: [[{ text: "🛍️ Browse Products", callback_data: "browse" }]] } };
        if (messageId) await bot.editMessageText(message, { chat_id: chatId, message_id: messageId, ...opts });
        else await bot.sendMessage(chatId, message, opts);
        return;
      }

      let message = "📦 Your Orders\n\n";
      orders.slice(0, 5).forEach(order => {
        const statusEmoji = order.status === 'pending_confirmation' ? "⏳" : "✅";
        message += `${statusEmoji} Order ${order.id.slice(0, 8)}... - ₦${(order.total || 0).toLocaleString()}\n`;
        message += `Status: ${order.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}\n\n`;
      });

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📊 Track Order", callback_data: "track_order" },
              { text: "🏠 Main Menu", callback_data: "start" }
            ]
          ]
        }
      };

      if (messageId) await bot.editMessageText(message, { chat_id: chatId, message_id: messageId, ...opts });
      else await bot.sendMessage(chatId, message, opts);
    } catch (error) {
      console.error('❌ Error in showMyOrders:', error.message);
    }
  };

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (msg.text === '📦 My Orders') {
      await showMyOrders(chatId, msg.from.id);
      return;
    }

    if (orderTrackingSessions.has(chatId)) {
      const searchTerm = msg.text.trim();
      let order = await getOrderById(searchTerm);
      if (!order) {
        const phoneOrders = await getOrdersByPhone(searchTerm);
        if (phoneOrders.length > 0) order = phoneOrders[phoneOrders.length - 1];
      }

      if (!order) {
        await bot.sendMessage(chatId, "No order found with that information", {
          reply_markup: { inline_keyboard: [[{ text: "Back to Menu", callback_data: "start" }]] }
        });
      } else {
        const status = order.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        const message = `Order Status: ${status}\n\n` +
          `Order ID: ${order.id}\n` +
          `Total: ₦${(order.total || 0).toLocaleString()}\n` +
          `Estimated Delivery: ${order.status === 'confirmed' ? '24 to 48 hours' : 'Pending confirmation'}`;
        
        await bot.sendMessage(chatId, message, {
          reply_markup: { inline_keyboard: [[{ text: "Back to Menu", callback_data: "start" }]] }
        });
      }
      orderTrackingSessions.delete(chatId);
    }
  });

  bot.on('callback_query', async (query) => {
    try {
      const chatId = query.message.chat.id;
      const userId = query.from.id;

      if (query.data === 'my_orders') {
        await bot.answerCallbackQuery(query.id);
        await showMyOrders(chatId, userId, query.message.message_id);
      } else if (query.data === 'track_order') {
        await bot.answerCallbackQuery(query.id);
        orderTrackingSessions.add(chatId);
        await bot.sendMessage(chatId, "Please enter your Order ID or phone number to track your order.\nSend it now:");
      }
    } catch (error) {
      console.error('❌ Error in orders callback:', error.message);
    }
  });
}
