import { initBot } from './bot/bloomlynBot.js';
import { initScraper, startListening } from './scraper/telegramScraper.js';
import config from './config.js';
import { initFirestore } from './db/firestore.js';


// Import pipeline stages
import { classifyProduct } from './pipeline/classifier.js';
import { extractProductData } from './pipeline/extractor.js';
import { findDuplicate } from './pipeline/duplicateDetector.js';
import { uploadAndGetFileId } from './pipeline/storage.js';
import { compositeImage, initCompositor } from './pipeline/imageCompositor.js';
import { insertProduct, updateProduct, getOrCreateVendor } from './db/firestore.js';
import { notifyChannel, notifyAdmin, notifyAdminStatus } from './bot/channelNotifier.js';
import jobQueue from './queue/jobQueue.js';

async function main() {
  try {
    console.log('🔄 Initializing Bloomlyn Bot Pipeline...');

    // 1. Initialize Database
    initFirestore();

    // 2. Start Customer Bot
    const bot = initBot();

    // 3. Initialize Compositor (Optional AI Enhancement)
    initCompositor();

    // 3. Start Telegram Scraper
    // The scraper listens to vendor channels and feeds the pipeline
    if (config.scraper.apiId && config.scraper.apiHash) {
       await initScraper();
       
       // Handle incoming vendor posts
       await startListening(async (post) => {
         // Queue it for sequential processing to avoid AI rate limits
         jobQueue.enqueue(async () => {
           const logMsg = `🧵 <b>Processing new post</b> from <code>${post.vendorId}</code>`;
           console.log(logMsg.replace(/<[^>]*>/g, ''));
           await notifyAdminStatus(bot, logMsg);

           // Step 1: Classification
           const category = await classifyProduct(post.caption);
           if (!category) {
             const skipMsg = `⏩ Skipping post from ${post.vendorId}: Could not determine category`;
             console.log(skipMsg);
             await notifyAdminStatus(bot, `❌ <b>Skipped:</b> Category unknown`);
             return;
           }
           await notifyAdminStatus(bot, `🎯 Classified as: <b>${category}</b>`);

           // Step 2: Extraction
           const data = await extractProductData(post.caption, category);
           if (data.vendor_price === 0) {
             const skipMsg = `⏩ Skipping post from ${post.vendorId}: No price extracted`;
             console.log(skipMsg);
             await notifyAdminStatus(bot, `❌ <b>Skipped:</b> No price found in caption`);
             return;
           }
           await notifyAdminStatus(bot, `📦 Extracted: <b>${data.name}</b> (₦${data.vendor_price.toLocaleString()})`);

           // Step 3: Duplicate Detection
           const duplicate = await findDuplicate({ name: data.name, description: data.description, category });
           
           // Step 4: AI Image Enhancement (Optional)
           let imageToUpload = post.imageBuffer;
           try {
             await notifyAdminStatus(bot, `✨ <b>Enhancing image...</b>`);
             const enhancedImage = await compositeImage(post.imageBuffer, category.toLowerCase().replace(/s$/, ''));
             if (enhancedImage) imageToUpload = enhancedImage;
           } catch (err) {
             console.warn('⚠️ Image compositing failed, using original');
           }

           // Step 5: Storage (Upload via bot to get file_id)
           await notifyAdminStatus(bot, `☁️ <b>Finalizing storage...</b>`);
           const fileId = await uploadAndGetFileId(bot, imageToUpload, config.adminTelegramId);
           if (!fileId) {
             console.log('⏩ Skipping post: Image upload failed');
             await notifyAdminStatus(bot, `❌ <b>Skipped:</b> Storage upload failed`);
             return;
           }

           // Step 5: Pricing
           const profit = config.profitMargins[category.toLowerCase().replace(/s$/, '')] || 1000;
           const sellingPrice = data.vendor_price + profit;

           // Step 6: DB Store or Update
           const vendor = await getOrCreateVendor(post.vendorId);
           
           if (duplicate) {
             console.log(`🔄 Updating existing product: ${duplicate.name}`);
             await updateProduct(duplicate.id, {
               vendor_price: data.vendor_price,
               selling_price: sellingPrice,
               telegram_file_id: fileId
             });
             // Notify channel about price update
             await notifyChannel(bot, { ...duplicate, selling_price: sellingPrice, telegram_file_id: fileId });
             await notifyAdminStatus(bot, `🔄 <b>Updated existing product:</b> ${duplicate.name}`);
           } else {
             console.log(`✨ Inserting new product: ${data.name}`);
             const productId = await insertProduct({
               name: data.name,
               category,
               vendor_price: data.vendor_price,
               selling_price: sellingPrice,
               profit,
               description: data.description,
               telegram_file_id: fileId,
               normalized_name: data.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
               vendor_id: vendor.id,
               status: 'active'
             });
             // Notify channel about new product
             await notifyChannel(bot, { id: productId, name: data.name, selling_price: sellingPrice, description: data.description, telegram_file_id: fileId });
             
             // Final Admin notification with Approve/Reject buttons
             await notifyAdmin(bot, {
               id: productId,
               name: data.name,
               category,
               vendor_price: data.vendor_price,
               selling_price: sellingPrice,
               description: data.description,
               telegram_file_id: fileId,
               vendor_id: vendor.id
             });
           }
         });
       });
       
       console.log('📡 Telegram Scraper started');
    } else {
       console.warn('⚠️ Scraper credentials missing. Scraper not started.');
    }

    console.log('✅ Pipeline fully operational.');
  } catch (error) {
    console.error('❌ Failed to start pipeline:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('👋 Shutting down... Exiting...');
  process.exit(0);
});

main();
