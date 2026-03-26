import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db;

/**
 * Initialize Firestore using the legacy service account key
 */
export function initFirestore() {
  if (db) return db;

  try {
    let serviceAccount;

    // 1. Check for Environment Variable (Best for Railway/Production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        console.log('📡 Loading Firebase credentials from environment variable (FIREBASE_SERVICE_ACCOUNT)');
      } catch (e) {
        console.error('❌ FIREBASE_SERVICE_ACCOUNT env var is not valid JSON');
      }
    }

    // 2. Fallback to local file
    if (!serviceAccount) {
      const serviceAccountPath = path.resolve(__dirname, '../../legacy/service-account-key.json');
      if (fs.existsSync(serviceAccountPath)) {
        serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        console.log(`📂 Loading Firebase credentials from local file: ${serviceAccountPath}`);
      }
    }

    if (!serviceAccount) {
      throw new Error('No Firebase credentials found (env or file)');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    db = admin.firestore();
    console.log('✅ Firestore (Production) initialized successfully');
    return db;
  } catch (error) {
    console.error('❌ Failed to initialize Firestore:', error.message);
    throw error;
  }
}

export function getDb() {
  if (!db) return initFirestore();
  return db;
}

// ==================== PRODUCT QUERIES ====================

export async function getProductsByCategory(category) {
  const snapshot = await getDb()
    .collection('bloomlyn_products')
    .where('category', '==', category)
    .where('status', '==', 'active')
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getProductById(productId) {
  if (!productId || typeof productId !== 'string') {
    return null;
  }
  const doc = await getDb().collection('bloomlyn_products').doc(productId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

export async function findProductByNormalizedName(normalizedName) {
  const snapshot = await getDb()
    .collection('bloomlyn_products')
    .where('normalized_name', '==', normalizedName)
    .limit(1)
    .get();
  return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

export async function insertProduct(productData) {
  const docRef = await getDb().collection('bloomlyn_products').add({
    ...productData,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });
  return docRef.id;
}

export async function updateProduct(productId, updates) {
  await getDb().collection('bloomlyn_products').doc(productId).update({
    ...updates,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ==================== PENDING PRODUCT QUERIES ====================

export async function insertPendingProduct(productData) {
  const docRef = await getDb().collection('bloomlyn_pending_products').add({
    ...productData,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
  return docRef.id;
}

export async function getPendingProductById(pendingId) {
  if (!pendingId || typeof pendingId !== 'string') return null;
  const doc = await getDb().collection('bloomlyn_pending_products').doc(pendingId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

export async function deletePendingProduct(pendingId) {
  if (!pendingId) return;
  await getDb().collection('bloomlyn_pending_products').doc(pendingId).delete();
}

// ==================== USER QUERIES ====================

export async function getOrCreateUser(telegramId, userData = {}) {
  const docRef = getDb().collection('bloomlyn_users').doc(String(telegramId));
  const doc = await docRef.get();

  if (doc.exists) return { id: doc.id, ...doc.data() };

  const newUser = {
    telegram_id: String(telegramId),
    first_name: userData.first_name || '',
    last_name: userData.last_name || '',
    username: userData.username || '',
    cart: [],
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  await docRef.set(newUser);
  return { id: String(telegramId), ...newUser };
}

export async function updateCart(userId, cart) {
  await getDb().collection('bloomlyn_users').doc(String(userId)).update({ cart });
}

// ==================== ORDER QUERIES ====================

export async function createOrder(userId, items, total, deliveryDetails) {
  const docRef = await getDb().collection('bloomlyn_orders').add({
    user_id: String(userId),
    items,
    total,
    delivery_details: deliveryDetails,
    status: 'pending_confirmation',
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
  return docRef.id;
}

export async function getOrdersByUserId(userId) {
  const snapshot = await getDb()
    .collection('bloomlyn_orders')
    .where('user_id', '==', String(userId))
    .orderBy('created_at', 'desc')
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getOrdersByPhone(phone) {
  const snapshot = await getDb()
    .collection('bloomlyn_orders')
    .where('delivery_details.phone', '==', String(phone))
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getOrderById(orderId) {
  const doc = await getDb().collection('bloomlyn_orders').doc(orderId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

// ==================== VENDOR QUERIES ====================

export async function getOrCreateVendor(channelId, name = '') {
  const docRef = getDb().collection('bloomlyn_vendors').doc(String(channelId));
  const doc = await docRef.get();

  if (doc.exists) return { id: doc.id, ...doc.data() };

  const newVendor = {
    channel_id: String(channelId),
    name: name || `Vendor ${channelId}`,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  await docRef.set(newVendor);
  return { id: String(channelId), ...newVendor };
}
