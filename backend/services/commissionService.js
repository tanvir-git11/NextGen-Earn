const { db, admin } = require('../firebase/firebaseAdmin');
const { getUplineChain } = require('./referralService');
const { calculateLevelCommission } = require('./levelService');

/**
 * Distributes commission to the referral chain based on the plan type.
 * 
 * @param {string} buyerUid    - Firebase UID of the user who bought the plan
 * @param {number} planAmount  - The plan amount (1000 or 2000)
 */
const distributeCommission = async (buyerUid, planAmount) => {
  try {
    const buyerDoc = await db.collection('users').doc(buyerUid).get();
    if (!buyerDoc.exists) return;

    const buyerData = buyerDoc.data();
    const parentReferralCode = buyerData.referredBy;

    if (!parentReferralCode) {
      console.log(`[Commission] No parent for user ${buyerUid}, skipping distribution.`);
      return;
    }

    // 1. Give direct commission (50% of the plan amount)
    const directCommissionAmount = planAmount * 0.5;
    
    // Find direct parent
    const parentSnapshot = await db
      .collection('users')
      .where('referralCode', '==', parentReferralCode)
      .limit(1)
      .get();

    if (!parentSnapshot.empty) {
      const parentDoc = parentSnapshot.docs[0];
      const parentUid = parentDoc.id;
      const parentData = parentDoc.data();

      if (!parentData.isBlocked) {
        await creditUserCommission(parentUid, directCommissionAmount, buyerUid, buyerData.userId, planAmount, 0);
        console.log(`[Commission] Direct 50% (${directCommissionAmount} BDT) → parent ${parentUid}`);
      }
    }

    // 2. Extra Generation System for Premium (2000 plan)
    if (planAmount === 2000) {
      const upline = await getUplineChain(buyerUid, 5); // Fetch up to 5 generations

      for (const uplineUser of upline) {
        // Skip direct parent if already credited (already handled in batch below or just check)
        // Actually, direct referrer and upline are separate roles in the user's logic requirements
        
        // Rule: Only premium users (2000 plan) can earn from the 5-generation level system
        if (uplineUser.plan !== 2000) continue;
        if (uplineUser.isBlocked) continue;

        const commissionAmount = calculateLevelCommission(uplineUser.level, planAmount);
        
        if (commissionAmount > 0) {
          await creditUserCommission(uplineUser.uid, commissionAmount, buyerUid, buyerData.userId, planAmount, uplineUser.generation);
          console.log(`[Commission] Generation ${uplineUser.generation} (${commissionAmount} BDT) → upline ${uplineUser.uid}`);
        }
      }
    }

  } catch (err) {
    console.error('[distributeCommission] Error:', err.message);
  }
};

/**
 * Credits a user with commission and logs the transaction.
 */
const creditUserCommission = async (recipientUid, amount, sourceUid, sourceUserId, planAmount, generation) => {
  const batch = db.batch();
  const recipientRef = db.collection('users').doc(recipientUid);
  
  batch.update(recipientRef, {
    balance: admin.firestore.FieldValue.increment(amount),
    totalEarnings: admin.firestore.FieldValue.increment(amount),
    availableSpins: admin.firestore.FieldValue.increment(12), // awarding spins per referral activation
  });

  const txRef = db.collection('transactions').doc();
  batch.set(txRef, {
    userId: recipientUid, // Note: Existing code uses UID here sometimes, but prompt says userId
    type: 'commission',
    amount: amount,
    status: 'approved',
    sourceUserId: sourceUserId, // From prompt requirement: sourceUserId
    generation: generation, // generation 0 = direct
    meta: {
      fromUserUid: sourceUid,
      fromUserId: sourceUserId,
      plan: planAmount,
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();
};

module.exports = { distributeCommission };
