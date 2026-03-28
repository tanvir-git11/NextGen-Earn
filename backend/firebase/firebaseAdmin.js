const admin = require('firebase-admin');

/**
 * Initialize Firebase Admin SDK.
 * Loads from serviceAccountKey.json for local dev.
 * For production, set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
 * and FIREBASE_PRIVATE_KEY env vars (and remove the JSON file).
 */

let serviceAccount;

// Load from JSON file (local development)
try {
  serviceAccount = require('./serviceAccountKey.json');
} catch (err) {
  // Fallback: build from env vars (production)
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  } else {
    console.error('❌ Firebase credentials not found. Place serviceAccountKey.json in backend/firebase/ or set env vars.');
    process.exit(1);
  }
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const auth = admin.auth();

// Enable Firestore timestamps in date objects
db.settings({ ignoreUndefinedProperties: true });

module.exports = { admin, db, auth };
