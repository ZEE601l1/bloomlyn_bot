import { getOrCreateUser, updateCart, createOrder, getProductById } from '../../db/firestore.js';
import config from '../../config.js';

// Checkout session state
const checkoutSessions = new Map();

export default function registerCheckout(bot) {
  bot.on('callback_query', async (query) => {
    try {
      const chatId = query.message.chat.id;
      const userId = query.from.id;
      const data = query.data;

      if (data === 'checkout') {
        await bot.answerCallbackQuery(query.id);
        const user = await getOrCreateUser(userId);
        const cart = user.cart || [];

        if (cart.length === 0) {
          return bot.sendMessage(chatId, "Your cart is empty");
        }

        checkoutSessions.set(chatId, {
          step: 'COLLECT_NAME',
          userId,
          cart
        });

        await bot.editMessageText(
          "Almost done!\n\nPlease share your delivery details\n\nFirst, what's your name?",
          { chat_id: chatId, message_id: query.message.message_id }
        );
      } else if (data === 'payment_done') {
        const session = checkoutSessions.get(chatId);
        if (!session || session.step !== 'AWAITING_PAYMENT') return;

        await bot.answerCallbackQuery(query.id);
        
        // Final confirmation to customer
        const confirmationMessage = "✅ ORDER PLACED SUCCESSFULLY!\n\n" +
          "Your order has been received. Please wait as we confirm your payment and process your order.\n\n" +
          "You can contact us @chat_bloomlyn for any inquiries.\n\n" +
          "Thank you for shopping with Bloomlyn🌸";

        await bot.editMessageText(confirmationMessage, {
          chat_id: chatId,
          message_id: query.message.message_id
        });

        // Notify Admin (we already created the order in COLLECT_ROOM step)
        const orderId = session.orderId;
        const adminMessage = `🔔 <b>NEW ORDER RECEIVED</b>\n\n` +
          `Order ID: ${orderId}\n` +
          `Customer: ${session.name}\n` +
          `Phone: ${session.phone}\n` +
          `Hall: ${session.hall}\n` +
          `Room: ${session.room}\n\n` +
          `📦 <b>Order Items:</b>\n` +
          session.orderSummary +
          `💰 <b>Total: ₦${session.total.toLocaleString()}</b>\n\n` +
          `Order ID: ${orderId}`;

        await bot.sendMessage(config.adminTelegramId, adminMessage, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: "✅ Confirm Order", callback_data: `confirm_order_${orderId}` }]]
          }
        });

        // Clear cart
        await updateCart(userId, []);
        checkoutSessions.delete(chatId);
      }
    } catch (error) {
      console.error('❌ Error in checkout callback:', error.message);
    }
  });

  bot.on('message', async (msg) => {
    try {
      const chatId = msg.chat.id;
      const session = checkoutSessions.get(chatId);
      if (!session) return;

      if (session.step === 'COLLECT_NAME') {
        session.name = msg.text;
        session.step = 'COLLECT_PHONE';
        await bot.sendMessage(chatId, "Great! Now, what's your telegram phone number?");
        return;
      }

      if (session.step === 'COLLECT_PHONE') {
        session.phone = msg.text;
        session.step = 'COLLECT_HALL';
        await bot.sendMessage(chatId, "Perfect! Which hall of residence are you in?");
        return;
      }

      if (session.step === 'COLLECT_HALL') {
        session.hall = msg.text;
        session.step = 'COLLECT_ROOM';
        await bot.sendMessage(chatId, "Last one! What's your room number?");
        return;
      }

      if (session.step === 'COLLECT_ROOM') {
        session.room = msg.text;
        session.step = 'AWAITING_PAYMENT';

        let total = 0;
        let itemizedSummary = "";
        const itemsWithDetails = [];

        for (const item of session.cart) {
          const product = await getProductById(item.product_id);
          if (product) {
            const price = product.selling_price || product.price || 0;
            const itemTotal = price * item.quantity;
            total += itemTotal;
            itemizedSummary += `• ${product.name}\n   ₦${price.toLocaleString()} × ${item.quantity} = ₦${itemTotal.toLocaleString()}\n\n`;
            itemsWithDetails.push({ ...product, quantity: item.quantity });
          }
        }

        // Create the official order in DB
        const orderId = await createOrder(session.userId, itemsWithDetails, total, {
          name: session.name,
          phone: session.phone,
          hall: session.hall,
          room: session.room
        });

        session.orderId = orderId;
        session.total = total;
        session.orderSummary = itemizedSummary;

        const summaryMessage = `📦 <b>YOUR ORDER SUMMARY</b>\n\n` +
          itemizedSummary +
          `Subtotal: ₦${total.toLocaleString()}\n` +
          `Delivery: FREE\n` +
          `Total: ₦${total.toLocaleString()}\n\n` +
          `Order ID: ${orderId}\n\n` +
          `💳 <b>PAYMENT DETAILS</b>\n` +
          `Account Number: ${config.payment.account}\n` +
          `Bank: ${config.payment.bank}\n` +
          `Account Name: ${config.payment.name}\n\n` +
          `📝 Use the Order ID as TRANSFER NARRATION when transferring.\n` +
          `After making the payment, click the button below.`;

        await bot.sendMessage(chatId, summaryMessage, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: "✅ Payment Done", callback_data: "payment_done" }]]
          }
        });
      }
    } catch (error) {
      console.error('❌ Error in checkout message handler:', error.message);
    }
  });
}
