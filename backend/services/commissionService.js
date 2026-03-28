const { db, admin } = require('../firebase/firebaseAdmin');

/**
 * Distributes exactly 50% commission (500 BDT) to the direct referrer (1 level)
 * when a user buys the 1000 BDT plan.
 *
 * @param {string} buyerUid    - Firebase UID of the user who bought the plan
 * @param {number} planAmount  - The plan amount (must be 1000)
 */
const distributeCommission = async (buyerUid, planAmount) => {
  try {
    if (planAmount !== 1000) return;

    // Get buyer's document to find their parent (referredBy)
    const buyerDoc = await db.collection('users').doc(buyerUid).get();
    if (!buyerDoc.exists) return;

    const buyerData = buyerDoc.data();
    const parentReferralCode = buyerData.referredBy;

    // No parent — stop
    if (!parentReferralCode) return;

    // Find parent user by their numeric referral code
    const parentSnapshot = await db
      .collection('users')
      .where('referralCode', '==', parentReferralCode)
      .limit(1)
      .get();

    if (parentSnapshot.empty) return;

    const parentDoc = parentSnapshot.docs[0];
    const parentUid = parentDoc.id;
    const parentData = parentDoc.data();

    // Do NOT give commission if parent is blocked
    if (parentData.isBlocked) return;

    // Direct commission is 50% (500 BDT)
    const commissionAmount = 500;

    // Use a Firestore batch to update balance + write transaction atomically
    const batch = db.batch();

    // Update parent's balance, totalEarnings, and availableSpins
    const parentRef = db.collection('users').doc(parentUid);
    batch.update(parentRef, {
      balance: admin.firestore.FieldValue.increment(commissionAmount),
      totalEarnings: admin.firestore.FieldValue.increment(commissionAmount),
      availableSpins: admin.firestore.FieldValue.increment(1),
    });

    // Write a commission transaction record
    const txRef = db.collection('transactions').doc();
    batch.set(txRef, {
      userId: parentData.userId || parentUid,
      type: 'commission',
      amount: commissionAmount,
      status: 'approved',
      meta: {
        fromUserUid: buyerUid,
        fromUserId: buyerData.userId || buyerUid,
        plan: planAmount
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    console.log(`[Commission] 500 BDT → parent ${parentData.userId || parentUid} (${parentUid})`);

  } catch (err) {
    console.error('[distributeCommission] Error:', err.message);
  }
};

module.exports = { distributeCommission };
