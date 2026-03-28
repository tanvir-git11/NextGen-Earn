const { db } = require('../firebase/firebaseAdmin');

/**
 * GET /api/user/profile
 * Returns the authenticated user's Firestore document (sanitized).
 */
const getProfile = async (req, res, next) => {
  try {
    const userData = req.user;
    // Exclude internal fields
    const { role, ...profile } = userData;

    return res.json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/user/referrer/:code
 * Returns public profile of the referrer.
 */
const getReferrerProfile = async (req, res, next) => {
  try {
    const { code } = req.params;
    const snapshot = await db.collection('users').where('referralCode', '==', code).limit(1).get();
    
    if (snapshot.empty) {
      return res.status(404).json({ success: false, message: 'Referrer not found' });
    }
    
    const data = snapshot.docs[0].data();
    return res.json({
      success: true,
      data: {
        name: data.name,
        email: data.email,
        referralCode: data.referralCode,
        createdAt: data.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/user/referrals
 * Returns a 5-level referral tree for the authenticated user.
 * Uses BFS (breadth-first search) to traverse referral chain.
 */
const getReferrals = async (req, res, next) => {
  try {
    const uid = req.uid;
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const myReferralCode = userDoc.data().referralCode;
    const tree = await buildReferralTree(myReferralCode, 5);

    return res.json({
      success: true,
      data: {
        referralCode: myReferralCode,
        totalReferrals: countNodes(tree),
        tree,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Recursively builds a referral tree up to maxDepth levels.
 *
 * @param {string} referralCode - The referral code to find children for
 * @param {number} maxDepth     - How many levels deep to traverse
 * @param {number} currentDepth - Current recursion depth (internal)
 * @returns {Array} Array of child user objects with nested children
 */
const buildReferralTree = async (referralCode, maxDepth, currentDepth = 1) => {
  if (currentDepth > maxDepth) return [];

  // Find all users who were referred by this referral code
  const snapshot = await db
    .collection('users')
    .where('referredBy', '==', referralCode)
    .get();

  if (snapshot.empty) return [];

  const children = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const childNode = {
      uid: doc.id,
      name: data.name,
      email: data.email,
      referralCode: data.referralCode,
      plan: data.plan,
      totalEarnings: data.totalEarnings,
      level: currentDepth,
      createdAt: data.createdAt,
      children: await buildReferralTree(data.referralCode, maxDepth, currentDepth + 1),
    };
    children.push(childNode);
  }

  return children;
};

const countNodes = (tree) => {
  if (!tree || tree.length === 0) return 0;
  return tree.reduce((acc, node) => acc + 1 + countNodes(node.children), 0);
};

/**
 * PUT /api/user/profile
 * Updates the user's name, email, and/or password.
 */
const updateProfile = async (req, res, next) => {
  try {
    const uid = req.uid;
    const { name, email, password } = req.body;
    
    const dbUpdates = {};
    const authUpdates = {};
    
    if (name && name.trim().length > 0) dbUpdates.name = name.trim();
    if (email && email.trim().length > 0) {
      dbUpdates.email = email.trim();
      authUpdates.email = email.trim();
    }
    if (password && password.length >= 6) {
      authUpdates.password = password;
    }

    if (Object.keys(authUpdates).length > 0) {
      const { getAuth } = require('firebase-admin/auth');
      try {
        await getAuth().updateUser(uid, authUpdates);
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-exists') {
          return res.status(400).json({ success: false, message: 'Email is already in use by another account.' });
        }
        throw authErr;
      }
    }

    if (Object.keys(dbUpdates).length > 0) {
      await db.collection('users').doc(uid).update(dbUpdates);
    }

    return res.json({ success: true, message: 'Profile updated successfully!' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, getReferrals, buildReferralTree, getReferrerProfile, updateProfile };
