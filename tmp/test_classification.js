import { classifyProduct } from '../src/pipeline/classifier.js';

async function test() {
  console.log('--- STARTING CLASSIFICATION TEST ---');
  
  const testCases = [
    { caption: "Chanel Chance 100ml available", expected: "Perfumes" },
    { caption: "Dior Sauvage EDP 200ml", expected: "Perfumes" },
    { caption: "LV Tote Bag Luxury Edition", expected: "Bags" },
    { caption: "Gold Zircon Necklace for her", expected: "Necklaces" },
    { caption: "18k Karat Bracelets", expected: "Bracelets" },
  ];

  for (const tc of testCases) {
    console.log(`Testing: "${tc.caption}"...`);
    try {
      const result = await classifyProduct(tc.caption);
      if (result === tc.expected) {
        console.log(`✅ MATCHED: ${result}`);
      } else {
        console.log(`❌ MISMATCH: Got "${result}", Expected "${tc.expected}"`);
      }
    } catch (e) {
      console.log(`❌ CRASHED: ${e.message}`);
    }
    console.log('---');
  }
  
  console.log('--- TEST FINISHED ---');
}

test();
