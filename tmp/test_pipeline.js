import { classifyProduct } from './src/pipeline/classifier.js';
import { extractProductData } from './src/pipeline/extractor.js';
import pkg from '../package.json' assert { type: 'json' };

async function testPipeline() {
  console.log('🧪 Testing AI Pipeline Fixes...');

  const testCaption = "Beautiful Gold Butterfly Necklace - N15,000. Limited stock!";
  
  try {
    console.log('\n1. Testing Classification...');
    const classification = await classifyProduct(testCaption);
    console.log('✅ Classification Result:', classification);

    console.log('\n2. Testing Extraction...');
    const extraction = await extractProductData(testCaption, classification?.category || 'Necklaces');
    console.log('✅ Extraction Result:', extraction);
    
    if (extraction.vendor_price === 15000) {
      console.log('\n🎉 SUCCESS: Data extracted correctly with structured output.');
    } else {
      console.log('\n⚠️ WARNING: Price extraction mismatch (Expected 15000).');
    }

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
  }
}

testPipeline();
