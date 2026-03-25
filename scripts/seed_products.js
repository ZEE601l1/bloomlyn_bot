import { initFirestore, getDb } from '../src/db/firestore.js';
import admin from 'firebase-admin';

async function seed() {
  const db = initFirestore();
  
  const products = [
    // Necklaces
    {
      name: "Emerald Gold Necklace",
      category: "Necklaces",
      description: "A stunning emerald piece set in 18k gold plating.",
      price: 15000,
      selling_price: 16000,
      status: "active",
      normalized_name: "emerald_gold_necklace",
      telegram_file_id: "" // To be populated by bot on first view or scraper
    },
    {
      name: "Gold Butterfly Necklace",
      category: "Necklaces",
      description: "Delicate butterfly pendant on a fine gold chain.",
      price: 12000,
      selling_price: 13000,
      status: "active",
      normalized_name: "gold_butterfly_necklace",
      telegram_file_id: ""
    },
    // Bracelets
    {
      name: "3-in-1 Stack Bracelet",
      category: "Bracelets",
      description: "Versatile triple stack bracelet for everyday elegance.",
      price: 8000,
      selling_price: 9000,
      status: "active",
      normalized_name: "3_in_1_stack_bracelet",
      telegram_file_id: ""
    },
    {
      name: "Gold & Silver Chunky Bracelet",
      category: "Bracelets",
      description: "Bold two-tone chunky link bracelet.",
      price: 10000,
      selling_price: 11000,
      status: "active",
      normalized_name: "gold_silver_chunky_bracelet",
      telegram_file_id: ""
    },
    // Rings
    {
      name: "Gold Rings Set",
      category: "Rings",
      description: "A collection of minimalist gold stackable rings.",
      price: 5000,
      selling_price: 6000,
      status: "active",
      normalized_name: "gold_rings_set",
      telegram_file_id: ""
    },
    {
      name: "Silver Butterfly Statement Ring",
      category: "Rings",
      description: "Eye-catching silver ring with a butterfly motif.",
      price: 7000,
      selling_price: 8000,
      status: "active",
      normalized_name: "silver_butterfly_ring",
      telegram_file_id: ""
    },
    // Perfumes
    {
      name: "Kaly Vanilla Perfume",
      category: "Perfumes",
      description: "Warm and inviting vanilla scent for all-day freshness.",
      price: 18000,
      selling_price: 21000,
      status: "active",
      normalized_name: "kaly_vanilla_perfume",
      telegram_file_id: ""
    },
    {
      name: "Oud Al Layl Perfume",
      category: "Perfumes",
      description: "Deep, mysterious oud fragrance with woody notes.",
      price: 25000,
      selling_price: 28000,
      status: "active",
      normalized_name: "oud_al_layl_perfume",
      telegram_file_id: ""
    },
    // Bags
    {
      name: "Black Baguette Bag",
      category: "Bags",
      description: "Classic black baguette bag, perfect for outings.",
      price: 35000,
      selling_price: 38000,
      status: "active",
      normalized_name: "black_baguette_bag",
      telegram_file_id: ""
    },
    {
      name: "Black MiuMiu Inspired Bag",
      category: "Bags",
      description: "Elegant black handbag with detailed quilting.",
      price: 45000,
      selling_price: 48000,
      status: "active",
      normalized_name: "black_miumiu_bag",
      telegram_file_id: ""
    }
  ];

  console.log(`🌱 Seeding ${products.length} products...`);

  for (const product of products) {
    const existing = await db.collection('bloomlyn_products')
      .where('normalized_name', '==', product.normalized_name)
      .get();
    
    if (existing.empty) {
      await db.collection('bloomlyn_products').add({
        ...product,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ Added: ${product.name}`);
    } else {
      console.log(`⏩ Skipping (exists): ${product.name}`);
    }
  }

  console.log('✨ Seeding complete!');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
