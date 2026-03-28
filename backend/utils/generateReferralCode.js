const { db } = require('../firebase/firebaseAdmin');

/**
 * Generates an 8-digit sequential numeric referral code.
 * Uses a Firestore transaction on system/counters to ensure atomicity.
 * @returns {Promise<string>} Next numeric ID as a string (e.g. "10000001")
 */
const generateReferralCode = async () => {
  const counterRef = db.collection('system').doc('counters');

  return await db.runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    // 8-digit start point: 10000000, so first user gets 10000001
    let nextId = 10000001; 

    if (counterDoc.exists) {
      const data = counterDoc.data();
      if (data.lastUserId) {
        nextId = parseInt(data.lastUserId, 10) + 1;
      }
    }

    // Atomically increment the lastUserId
    transaction.set(counterRef, { lastUserId: nextId }, { merge: true });

    return nextId.toString();
  });
};

module.exports = generateReferralCode;
