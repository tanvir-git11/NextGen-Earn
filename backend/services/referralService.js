const { db } = require('../firebase/firebaseAdmin');

/**
 * Recursively fetches the upline referral chain up to a specified depth.
 * 
 * @param {string} startUid   - Firebase UID of the user to get upline for
 * @param {number} maxDepth   - How many levels up to go (default 5)
 * @returns {Promise<Array>}  - Array of user documents (upline chain)
 */
const getUplineChain = async (startUid, maxDepth = 5) => {
  const chain = [];
  let currentUid = startUid;

  try {
    for (let i = 0; i < maxDepth; i++) {
      const userDoc = await db.collection('users').doc(currentUid).get();
      if (!userDoc.exists) break;

      const userData = userDoc.data();
      const parentReferralCode = userData.referredBy;

      if (!parentReferralCode) break;

      // Find parent by referral code
      const parentSnapshot = await db
        .collection('users')
        .where('referralCode', '==', parentReferralCode)
        .limit(1)
        .get();

      if (parentSnapshot.empty) break;

      const parentDoc = parentSnapshot.docs[0];
      const parentData = parentDoc.data();
      const parentUid = parentDoc.id;

      // Add parent to chain
      chain.push({
        uid: parentUid,
        ...parentData,
        generation: i + 1,
      });

      // Move up the tree
      currentUid = parentUid;
    }
  } catch (err) {
    console.error('[getUplineChain] Error:', err.message);
  }

  return chain;
};

module.exports = { getUplineChain };
