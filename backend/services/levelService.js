const { db, admin } = require('../firebase/firebaseAdmin');

/**
 * Calculates level-based commission for premium plan activities.
 * 
 * @param {number} level       - The upline user's level (1-5)
 * @param {number} planAmount  - The plan amount (usually 2000)
 * @returns {number}           - Commission amount
 */
const calculateLevelCommission = (level, planAmount) => {
  const percentages = {
    1: 0.05, // 5%
    2: 0.10, // 10%
    3: 0.20, // 20%
    4: 0.25, // 25%
    5: 0.50, // 50%
  };

  const percentage = percentages[level] || 0;
  return planAmount * percentage;
};

/**
 * Upgrades a user's level.
 * 
 * @param {string} uid    - Firebase UID
 * @param {number} fee    - Upgrade fee (flat 1500)
 * @returns {Promise<object>} - Result of upgrade
 */
const upgradeUserLevel = async (uid, fee = 1500) => {
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  const userData = userDoc.data();

  const currentLevel = userData.level || 0;
  const nextLevel = currentLevel + 1;

  if (nextLevel > 5) {
    throw new Error('Already at maximum level 5');
  }

  if (userData.balance < fee) {
    throw new Error(`Insufficient balance. You need ৳${fee} but have ৳${userData.balance}.`);
  }

  const batch = db.batch();

  // Deduct balance + increment level
  batch.update(userRef, {
    level: nextLevel,
    balance: admin.firestore.FieldValue.increment(-fee),
  });

  // Record level upgrade in transactions
  const txRef = db.collection('transactions').doc();
  batch.set(txRef, {
    userId: userData.userId || uid,
    type: 'level_upgrade',
    amount: -fee,
    status: 'completed',
    meta: { fromLevel: currentLevel, toLevel: nextLevel },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Create admin notification
  const notifyRef = db.collection('notifications').doc();
  batch.set(notifyRef, {
    type: 'level_upgrade',
    userId: userData.userId || uid,
    userName: userData.name,
    newLevel: nextLevel,
    amount: fee,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return { success: true, newLevel: nextLevel };
};

module.exports = { calculateLevelCommission, upgradeUserLevel };
