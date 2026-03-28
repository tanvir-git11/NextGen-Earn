const { db, admin } = require('../firebase/firebaseAdmin');
const { distributeCommission } = require('../services/commissionService');

/**
 * POST /api/plan/buy
 * Checks balance → deducts plan amount → activates plan → distributes commissions.
 * Returns 402 with code INSUFFICIENT_BALANCE if user cannot afford the plan.
 */
const buyPlan = async (req, res, next) => {
  try {
    const uid = req.uid;
    const { plan } = req.body;
    const planAmount = parseInt(plan, 10);

    if (planAmount !== 1000) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan. Only the 1000 BDT plan is available.',
      });
    }

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    // ── Prevent re-purchasing the same plan ─────────────────────────────────
    if (userData.plan === planAmount) {
      return res.status(400).json({
        success: false,
        message: `You are already on the ${planAmount} plan`,
      });
    }

    // ── Prevent downgrading plan ─────────────────────────────────────────────
    if (userData.plan > planAmount) {
      return res.status(400).json({
        success: false,
        message: 'You cannot downgrade your plan',
      });
    }

    // ── Check balance ────────────────────────────────────────────────────────
    const currentBalance = userData.balance || 0;
    if (currentBalance < planAmount) {
      return res.status(402).json({
        success: false,
        code: 'INSUFFICIENT_BALANCE',
        message: `Insufficient balance! You need ৳${planAmount} but have ৳${currentBalance}. Please deposit ৳${planAmount - currentBalance} first.`,
        data: {
          required: planAmount,
          available: currentBalance,
          shortfall: planAmount - currentBalance,
        },
      });
    }

    // ── Deduct balance + activate plan (atomic batch) ────────────────────────
    const batch = db.batch();
    batch.update(userRef, {
      plan: planAmount,
      level: 1, // Set to Level 1 initially
      balance: admin.firestore.FieldValue.increment(-planAmount),
    });

    // Record plan purchase in transactions
    const txRef = db.collection('transactions').doc();
    batch.set(txRef, {
      userId: userData.userId || uid, // Use numeric userId
      type: 'plan_purchase',
      amount: -planAmount,
      status: 'completed',
      meta: { plan: planAmount },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // ── Distribute commissions to referral chain ─────────────────────────────
    await distributeCommission(uid, planAmount);

    return res.json({
      success: true,
      message: `Plan ${planAmount} activated! ৳${planAmount} deducted from your balance.`,
      data: { plan: planAmount, deducted: planAmount },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/plan/upgrade
 * Upgrades the user's level if they have enough balance for the fee.
 */
const upgradePlan = async (req, res, next) => {
  try {
    const uid = req.uid;
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    const currentLevel = userData.level || 1;
    
    const LEVELS = {
      1: { fee: 1500, nextLevel: 2 },
      2: { fee: 3000, nextLevel: 3 },
      3: { fee: 5000, nextLevel: 4 },
      4: { fee: 10000, nextLevel: 5 },
      5: { fee: 0, nextLevel: null }
    };

    if (currentLevel >= 5) {
      return res.status(400).json({ success: false, message: 'You are already at the maximum level.' });
    }

    const { fee, nextLevel } = LEVELS[currentLevel];

    if (userData.balance < fee) {
      return res.status(402).json({
        success: false,
        message: `Insufficient balance to upgrade to Level ${nextLevel}. You need ৳${fee}.`
      });
    }

    const batch = db.batch();
    batch.update(userRef, {
      level: nextLevel,
      balance: admin.firestore.FieldValue.increment(-fee),
    });

    const txRef = db.collection('transactions').doc();
    batch.set(txRef, {
      userId: userData.userId || uid,
      type: 'level_upgrade',
      amount: -fee,
      status: 'completed',
      meta: { fromLevel: currentLevel, toLevel: nextLevel },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return res.json({
      success: true,
      message: `Successfully upgraded to Level ${nextLevel}! ৳${fee} deducted.`,
      data: { level: nextLevel, deducted: fee }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { buyPlan, upgradePlan };
