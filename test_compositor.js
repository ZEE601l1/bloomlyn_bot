import { compositeImage, initCompositor } from './src/pipeline/imageCompositor.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
  console.log('🧪 Testing AI Compositor...');
  
  const initialized = initCompositor();
  if (!initialized) {
    console.error('❌ Failed to initialize compositor. Check GEMINI_API_KEY.');
    return;
  }

  // Create a dummy 1x1 black pixel buffer if no real image is found
  const dummyBuffer = Buffer.from('R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=', 'base64');
  
  console.log('Testing category: perfume');
  const result = await compositeImage(dummyBuffer, 'perfume');
  
  if (result) {
    console.log('✅ SUCCESS: AI returned an image buffer.');
    fs.writeFileSync('test_output_perfume.jpg', result);
    console.log('Saved to test_output_perfume.jpg');
  } else {
    console.log('❌ FAILURE: AI returned no image.');
  }
}

test().catch(console.error);
