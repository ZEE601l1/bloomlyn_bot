import config from '../../config.js';
import { getDb, getProductById } from '../../db/firestore.js';
import admin from 'firebase-admin';

export default function registerAdmin(bot) {
  bot.onText(/\/admin/, async (msg) => {
    try {
      if (msg.from.id !== config.adminTelegramId) return;

      await bot.sendMessage(msg.chat.id, 'Admin Panel', {
        reply_markup: {
          inline_keyboard: [
            [{ text: "View Orders", callback_data: "admin_orders" }],
            [{ text: "Add Product (AI Handle Automatically)", callback_data: "no_op" }],
            [{ text: "View Products", callback_data: "admin_view_products" }]
          ]
        }
      });
    } catch (error) {
      console.error('❌ Error in /admin handler:', error.message);
    }
  });

  bot.on('callback_query', async (query) => {
    try {
      const chatId = query.message.chat.id;
      const data = query.data;

      if (query.from.id !== config.adminTelegramId) return;

      if (data === 'admin_orders') {
        const ordersSnapshot = await getDb().collection('bloomlyn_orders').orderBy('created_at', 'desc').limit(10).get();
        const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (orders.length === 0) return bot.answerCallbackQuery(query.id, { text: "No orders yet" });

        let message = "Orders (Recent)\n\n";
        orders.forEach(o => {
          message += `ID: ${o.id.slice(0, 8)}...\n`;
          message += `Customer: ${o.delivery_details?.name || 'Unknown'}\n`;
          message += `Total: ₦${(o.total || 0).toLocaleString()}\n`;
          message += `Status: ${o.status}\n\n`;
        });

        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: { inline_keyboard: [[{ text: "Back", callback_data: "admin_back" }]] }
        });
      }

      if (data.startsWith('confirm_order_')) {
        const orderId = data.replace('confirm_order_', '');
        const orderRef = getDb().collection('bloomlyn_orders').doc(orderId);
        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) return bot.answerCallbackQuery(query.id, { text: "Order not found" });

        const order = orderDoc.data();
        await orderRef.update({
          status: 'confirmed',
          confirmed_at: admin.firestore.FieldValue.serverTimestamp()
        });

        await bot.answerCallbackQuery(query.id, { text: "Order confirmed! ✅" });
        await bot.editMessageText(`✅ Order ${orderId} has been confirmed`, {
          chat_id: chatId,
          message_id: query.message.message_id
        });

        // Notify Customer
        let orderSummary = "🎉 YOUR ORDER HAS BEEN CONFIRMED!\n\n" +
          `Order ID: ${orderId}\n\n` +
          "Your Order:\n";
        
        order.items.forEach((item, i) => {
          const price = item.selling_price || item.price || 0;
          orderSummary += `${i + 1}. ${item.name}\n   ₦${price.toLocaleString()} × ${item.quantity} = ₦${(price * item.quantity).toLocaleString()}\n\n`;
        });

        orderSummary += `- Total Paid: ₦${(order.total || 0).toLocaleString()}\n\n`;
        orderSummary += "Your order will be delivered to you within 24 to 48 hours.\n";
        orderSummary += "We'll contact you on the phone number you provided for delivery updates.\n";
        orderSummary += "Join our telegram channel @bloomlyn_store for new products updates.\n\n";
        orderSummary += "Thank you for shopping with Bloomlyn🌸";

        await bot.sendMessage(order.user_id, orderSummary);
      }

      if (data === 'admin_view_products') {
        const productsSnapshot = await getDb().collection('bloomlyn_products').limit(10).get();
        const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        let message = "All Products\n\n";
        products.forEach(p => {
          message += `${p.name} - ₦${(p.selling_price || p.price || 0).toLocaleString()}\n`;
          message += `Category: ${p.category}\nID: ${p.id}\n\n`;
        });

        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: { inline_keyboard: [[{ text: "Back", callback_data: "admin_back" }]] }
        });
      }

      if (data === 'admin_back') {
        await bot.editMessageText('Admin Panel', {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: "View Orders", callback_data: "admin_orders" }],
              [{ text: "View Products", callback_data: "admin_view_products" }]
            ]
          }
        });
      }
    } catch (error) {
      console.error('❌ Error in admin callback handler:', error.message);
    }
  });
}
