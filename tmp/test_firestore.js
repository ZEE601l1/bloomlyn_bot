import { getProductById } from '../src/db/firestore.js';

async function test() {
  console.log('Testing getProductById with invalid inputs...');
  
  const testCases = [
    { input: undefined, expected: null },
    { input: null, expected: null },
    { input: '', expected: null },
    { input: 123, expected: null },
    { input: {}, expected: null },
  ];

  for (const tc of testCases) {
    try {
      const result = await getProductById(tc.input);
      if (result === tc.expected) {
        console.log(`✅ Input ${JSON.stringify(tc.input)}: Passed`);
      } else {
        console.log(`❌ Input ${JSON.stringify(tc.input)}: Failed (Got ${result})`);
      }
    } catch (e) {
      console.log(`❌ Input ${JSON.stringify(tc.input)}: Crashed with error: ${e.message}`);
    }
  }
}

// Note: This script might fail to run if it tries to initialize Firebase without credentials,
// but it verifies the logic we added before the doc() call.
test();
