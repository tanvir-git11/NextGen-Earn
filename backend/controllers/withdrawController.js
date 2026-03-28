const { db, admin } = require('../firebase/firebaseAdmin');

/**
 * POST /api/withdraw
 * Submits a withdraw request as pending (balance is NOT deducted yet).
 * Admin approves → balance is deducted at that point.
 */
const requestWithdraw = async (req, res, next) => {
  try {
    const uid = req.uid;
    const { method, accountNumber, amount } = req.body;
    const amountNum = parseFloat(amount);

    // ── Check Dynamic Min Withdraw ──────────────────────────────────────
    const settingsDoc = await db.collection('settings').doc('config').get();
    const minWithdraw = settingsDoc.exists ? settingsDoc.data().minWithdraw : 500;

    if (amountNum < minWithdraw) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is ${minWithdraw} BDT`,
      });
    }

    // ── Check 5-Level Referral Constraints ───────────────────────────────
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();

    const allRefsSnapshot = await db.collection('users')
      .where('referredBy', '==', userData.referralCode)
      .get();
    
    let activeRefsCount = 0;
    allRefsSnapshot.forEach(doc => {
      if (doc.data().plan > 0) activeRefsCount++;
    });

    const currentLevel = userData.level || 1;
    
    // STRICT CONSTRAINT: Withdrawals completely locked until Level 2 (User requested logic)
    if (currentLevel < 2) {
      return res.status(403).json({
        success: false,
        message: 'Withdrawals are locked! You must reach Level 2 to unlock withdrawals ' + 
                 '(Complete your 5 referral target and upgrade your plan).'
      });
    }

    const LEVELS = {
      1: { maxRefs: 5 },
      2: { maxRefs: 15 },
      3: { maxRefs: 30 },
      4: { maxRefs: 50 },
      5: { maxRefs: 999999 }
    };

    if (activeRefsCount >= LEVELS[currentLevel].maxRefs && currentLevel < 5) {
      return res.status(403).json({
        success: false,
        message: `Withdrawal locked! You have reached the referral limit (${LEVELS[currentLevel].maxRefs}) for Level ${currentLevel}. Please upgrade to Level ${currentLevel + 1} in the Plans page to continue withdrawing.`
      });
    }

    // ── Validate sufficient balance ────────────────────────────────────────
    const balance = userData.balance || 0;
    if (amountNum > balance) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ${balance} BDT`,
      });
    }

    // ── Check for too many pending withdrawals ─────────────────────────────
    const pendingCheck = await db
      .collection('withdraws')
      .where('userId', '==', uid)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!pendingCheck.empty) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending withdrawal. Please wait for approval.',
      });
    }

    // ── Save withdraw document ─────────────────────────────────────────────
    const withdrawRef = db.collection('withdraws').doc();
    await withdrawRef.set({
      userId: uid,
      method,        // bkash | nagad
      accountNumber,
      amount: amountNum,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted. Awaiting admin approval.',
      data: { withdrawId: withdrawRef.id, amount: amountNum, method, status: 'pending' },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/withdraw/history
 * Returns the authenticated user's withdrawal history.
 */
const getWithdrawHistory = async (req, res, next) => {
  try {
    const uid = req.uid;
    const snapshot = await db
      .collection('withdraws')
      .where('userId', '==', uid)
      .limit(50)
      .get();

    const withdraws = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
    }));

    withdraws.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ success: true, count: withdraws.length, data: withdraws });
  } catch (err) {
    next(err);
  }
};

module.exports = { requestWithdraw, getWithdrawHistory };
