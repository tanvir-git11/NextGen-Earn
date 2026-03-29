const { db, admin } = require('../firebase/firebaseAdmin');
const { distributeCommission } = require('../services/commissionService');
const { upgradeUserLevel } = require('../services/levelService');

/**
 * POST /api/plan/buy
 * Supports both 1000 (Basic) and 2000 (Premium) plans.
 */
const buyPlan = async (req, res, next) => {
  try {
    const uid = req.uid;
    const { plan } = req.body;
    const planAmount = parseInt(plan, 10);

    if (planAmount !== 1000 && planAmount !== 2000) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan. Choose either 1000 or 2000 BDT.',
      });
    }

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    if (userData.plan === planAmount) {
      return res.status(400).json({
        success: false,
        message: `You are already on the ${planAmount} plan`,
      });
    }

    if (userData.plan > planAmount) {
      return res.status(400).json({
        success: false,
        message: 'You cannot downgrade your plan',
      });
    }

    const currentBalance = userData.balance || 0;
    if (currentBalance < planAmount) {
      return res.status(402).json({
        success: false,
        code: 'INSUFFICIENT_BALANCE',
        message: `Insufficient balance! You need ৳${planAmount} but have ৳${currentBalance.toLocaleString()}.`,
      });
    }

    const batch = db.batch();
    batch.update(userRef, {
      plan: planAmount,
      level: 1, // Set to Level 1 initially
      balance: admin.firestore.FieldValue.increment(-planAmount),
    });

    const txRef = db.collection('transactions').doc();
    batch.set(txRef, {
      userId: uid,
      type: 'plan_purchase',
      amount: -planAmount,
      status: 'completed',
      meta: { plan: planAmount },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // Trigger asynchronous commission distribution
    distributeCommission(uid, planAmount).catch(console.error);

    return res.json({
      success: true,
      message: `Plan ${planAmount} activated successfully!`,
      data: { plan: planAmount, deducted: planAmount },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/level/upgrade
 * Upgrades the user's level for a flat 1500 BDT fee.
 */
const upgradeLevel = async (req, res, next) => {
  try {
    const uid = req.uid;
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();

    if (userData.plan === 0) {
      return res.status(400).json({
        success: false,
        message: 'You must buy a plan first before upgrading your level.',
      });
    }

    // Only Premium plan users can use the level system fully (as requested)
    if (userData.plan < 2000) {
      return res.status(403).json({
        success: false,
        message: 'Level upgrades are only available for Premium Plan (2000 BDT).',
      });
    }

    const result = await upgradeUserLevel(uid, 1500);

    return res.json({
      success: true,
      message: `Successfully upgraded to Level ${result.newLevel}! ৳1,500 deducted.`,
      data: { level: result.newLevel, deducted: 1500 }
    });
    } catch (err) {
    if (
      err.message.includes('Already at maximum') || 
      err.message.includes('Insufficient Balance') || 
      err.message.includes('Referral Milestone Required')
    ) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
};

module.exports = { buyPlan, upgradeLevel };
