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
        // Direct parent always gets 50% regardless of plan amount (1000 or 2000)
        // AND we increment their directRefCount to facilitate their level upgrades
        await creditUserCommission(parentUid, directCommissionAmount, buyerUid, buyerData.userId, planAmount, 0, true);
        console.log(`[Commission] Direct 50% (${directCommissionAmount} BDT) → parent ${parentUid}`);
      }
    }

    // 2. Extra Generation System for Premium (2000 plan)
    if (planAmount === 2000) {
      // Find upline up to 5 generations, EXCLUDING the direct parent (already processed above)
      const upline = await getUplineChain(buyerUid, 5); 

      for (const uplineUser of upline) {
        // Skip direct parent (Gen 1) as they already received the 50% flat commission
        if (uplineUser.generation <= 1) continue;

        // Rule: Only premium users (2000 plan) can earn from the 5-generation system (Gen 2-5)
        if (uplineUser.plan !== 2000) continue;
        if (uplineUser.isBlocked) continue;

        const commissionAmount = calculateLevelCommission(uplineUser.level, planAmount);
        
        if (commissionAmount > 0) {
          await creditUserCommission(uplineUser.uid, commissionAmount, buyerUid, buyerData.userId, planAmount, uplineUser.generation, false);
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
const creditUserCommission = async (recipientUid, amount, sourceUid, sourceUserId, planAmount, generation, isDirect = false) => {
  const batch = db.batch();
  const recipientRef = db.collection('users').doc(recipientUid);
  
  const updates = {
    balance: admin.firestore.FieldValue.increment(amount),
    totalEarnings: admin.firestore.FieldValue.increment(amount),
    availableSpins: admin.firestore.FieldValue.increment(12),
  };

  // If this is a direct referral, increment their ref count for level progression
  if (isDirect) {
    updates.directRefCount = admin.firestore.FieldValue.increment(1);
  }

  batch.update(recipientRef, updates);

  const txRef = db.collection('transactions').doc();
  batch.set(txRef, {
    userId: recipientUid,
    type: 'commission',
    amount: amount,
    status: 'approved',
    sourceUserId: sourceUserId,
    generation: generation, 
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
