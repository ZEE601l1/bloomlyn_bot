import { extractProductData } from '../src/pipeline/extractor.js';

async function test() {
  console.log('--- STARTING EXTRACTION TEST ---');
  
  const testCases = [
    { 
      caption: "Chanel Chance 100ml available for ₦85,000. Fresh scent.", 
      category: "Perfumes",
      expected: { name: "Chanel Chance 100ml", price: 85000 }
    },
    { 
      caption: "LV Tote Bag Luxury Edition - Price: N120000", 
      category: "Bags",
      expected: { name: "LV Tote Bag Luxury Edition", price: 120000 }
    },
  ];

  for (const tc of testCases) {
    console.log(`Testing: "${tc.caption}"...`);
    try {
      const result = await extractProductData(tc.caption, tc.category);
      console.log('Result:', JSON.stringify(result, null, 2));
      if (result.vendor_price === tc.expected.price) {
        console.log(`✅ PRICE MATCHED: ${result.vendor_price}`);
      } else {
        console.log(`❌ PRICE MISMATCH: Got "${result.vendor_price}", Expected "${tc.expected.price}"`);
      }
    } catch (e) {
      console.log(`❌ CRASHED: ${e.message}`);
    }
    console.log('---');
  }
  
  console.log('--- TEST FINISHED ---');
}

test();
