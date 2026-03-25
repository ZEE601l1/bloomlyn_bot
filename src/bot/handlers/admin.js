import config from '../../config.js';
import { getDb, getProductById, updateProduct } from '../../db/firestore.js';
import { notifyChannel } from '../channelNotifier.js';
import admin from 'firebase-admin';

export default function registerAdmin(bot) {
  bot.onText(/\/admin/, async (msg) => {
    try {
      if (msg.from.id !== config.adminTelegramId) return;

      await bot.sendMessage(msg.chat.id, 'Admin Panel', {
        reply_markup: {
          inline_keyboard: [
            [{ text: "View Orders", callback_data: "admin_orders" }],
            [{ text: "View Products", callback_data: "admin_view_products" }],
            [{ text: "🌱 Seed Sample Data", callback_data: "admin_seed" }]
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

      if (data === 'admin_seed') {
        const products = [
          { name: "Emerald Gold Necklace", category: "Necklaces", description: "A stunning emerald piece set in 18k gold plating.", price: 15000, selling_price: 16000, status: "active", normalized_name: "emerald_gold_necklace", telegram_file_id: "", image_path: "legacy/emeraldgoldnecklace.jpg" },
          { name: "Gold Butterfly Necklace", category: "Necklaces", description: "Delicate butterfly pendant on a fine gold chain.", price: 12000, selling_price: 13000, status: "active", normalized_name: "gold_butterfly_necklace", telegram_file_id: "", image_path: "legacy/goldbutterflynecklace.jpg" },
          { name: "3-in-1 Stack Bracelet", category: "Bracelets", description: "Versatile triple stack bracelet for everyday elegance.", price: 8000, selling_price: 9000, status: "active", normalized_name: "3_in_1_stack_bracelet", telegram_file_id: "", image_path: "legacy/3in1bracelet.jpg" },
          { name: "Gold & Silver Chunky Bracelet", category: "Bracelets", description: "Bold two-tone chunky link bracelet.", price: 10000, selling_price: 11000, status: "active", normalized_name: "gold_silver_chunky_bracelet", telegram_file_id: "", image_path: "legacy/goldandsilverchunkybracelet.jpg" },
          { name: "Gold Rings Set", category: "Rings", description: "A collection of minimalist gold stackable rings.", price: 5000, selling_price: 6000, status: "active", normalized_name: "gold_rings_set", telegram_file_id: "", image_path: "legacy/goldringsset.jpg" },
          { name: "Silver Butterfly Statement Ring", category: "Rings", description: "Eye-catching silver ring with a butterfly motif.", price: 7000, selling_price: 8000, status: "active", normalized_name: "silver_butterfly_ring", telegram_file_id: "", image_path: "legacy/silverbutterflystatementring.jpg" },
          { name: "Kaly Vanilla Perfume", category: "Perfumes", description: "Warm and inviting vanilla scent for all-day freshness.", price: 18000, selling_price: 21000, status: "active", normalized_name: "kaly_vanilla_perfume", telegram_file_id: "", image_path: "legacy/kalyvanillapef.jpg" },
          { name: "Oud Al Layl Perfume", category: "Perfumes", description: "Deep, mysterious oud fragrance with woody notes.", price: 25000, selling_price: 28000, status: "active", normalized_name: "oud_al_layl_perfume", telegram_file_id: "", image_path: "legacy/oudallaylpef.jpg" },
          { name: "Black Baguette Bag", category: "Bags", description: "Classic black baguette bag, perfect for outings.", price: 35000, selling_price: 38000, status: "active", normalized_name: "black_baguette_bag", telegram_file_id: "", image_path: "legacy/blackbaguettebag.jpg" },
          { name: "Black MiuMiu Inspired Bag", category: "Bags", description: "Elegant black handbag with detailed quilting.", price: 45000, selling_price: 48000, status: "active", normalized_name: "black_miumiu_bag", telegram_file_id: "", image_path: "legacy/blackmiumiubag.jpg" }
        ];

        await bot.answerCallbackQuery(query.id, { text: "Starting seed..." });
        await bot.editMessageText("🌱 Seeding sample products with images...", { chat_id: chatId, message_id: query.message.message_id });

        let addedCount = 0;
        const db = getDb();
        for (const product of products) {
          const existing = await db.collection('bloomlyn_products').where('normalized_name', '==', product.normalized_name).get();
          if (existing.empty) {
            await db.collection('bloomlyn_products').add({
              ...product,
              created_at: admin.firestore.FieldValue.serverTimestamp(),
              updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
            addedCount++;
          } else {
             // If already exists, update the image_path so lazy-upload can find it
             await existing.docs[0].ref.update({ image_path: product.image_path });
          }
        }

        await bot.editMessageText(`✅ Seeding complete! Added ${addedCount} new products.`, {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: { inline_keyboard: [[{ text: "Back to Menu", callback_data: "admin_back" }]] }
        });
      }

      if (data.startsWith('approve_product_')) {
        const productId = data.replace('approve_product_', '');
        const product = await getProductById(productId);

        if (!product) return bot.answerCallbackQuery(query.id, { text: "Product not found" });

        // Post to public channel
        await notifyChannel(bot, { id: productId, ...product });

        await bot.answerCallbackQuery(query.id, { text: "Product approved and posted! ✅" });
        await bot.editMessageText(`✅ <b>Approved & Posted:</b> ${product.name}`, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML'
        });
      }

      if (data.startsWith('reject_product_')) {
        const productId = data.replace('reject_product_', '');
        const product = await getProductById(productId);

        await bot.answerCallbackQuery(query.id, { text: "Product rejected ❌" });
        await bot.editMessageText(`❌ <b>Rejected:</b> ${product ? product.name : productId}`, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML'
        });
        
        // Optionally mark as inactive in DB
        if (product) {
          await updateProduct(productId, { status: 'rejected' });
        }
      }

      if (data === 'admin_back') {
        await bot.editMessageText('Admin Panel', {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: "View Orders", callback_data: "admin_orders" }],
              [{ text: "View Products", callback_data: "admin_view_products" }],
              [{ text: "🌱 Seed Sample Data", callback_data: "admin_seed" }]
            ]
          }
        });
      }
    } catch (error) {
      console.error('❌ Error in admin callback handler:', error.message);
    }
  });
}
