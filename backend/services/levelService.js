const { db, admin } = require('../firebase/firebaseAdmin');

/**
 * Calculates level-based commission for premium plan activities.
 * 
 * @param {number} level       - The upline user's level (1-5)
 * @param {number} planAmount  - The plan amount (usually 2000)
 * @returns {number}           - Commission amount
 */
const calculateLevelCommission = (level, planAmount) => {
  // Direct (Gen 1) is handled in commissionService. This is for Gen 2-5 (Indirect).
  // Level 1: 5%, Level 2: 10%, Level 3: 15%, Level 4: 20%, Level 5: 25%
  const percentage = 0.05 * level;
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

  const currentLevel = userData.level || 1;
  const nextLevel = currentLevel + 1;

  if (nextLevel > 5) {
    throw new Error('Already at maximum Level 5. You have reached the ultimate tier!');
  }

  // Define Referral Targets for each level upgrade
  const refTargets = {
    2: 8,   // To reach L2: 8 refs
    3: 20,  // To reach L3: 20 refs
    4: 40,  // To reach L4: 40 refs
    5: 75,  // To reach L5: 75 refs
  };

  const targetRefs = refTargets[nextLevel];
  const currentRefs = userData.directRefCount || 0; // Assuming we update this count on referral purchase

  if (currentRefs < targetRefs) {
    throw new Error(`Referral Milestone Required: You need ${targetRefs} active direct referrals to reach Level ${nextLevel}. Current: ${currentRefs}`);
  }

  if (userData.balance < fee) {
    throw new Error(`Insufficient Balance: Upgrade fee is ৳${fee}, but you have ৳${userData.balance}.`);
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
