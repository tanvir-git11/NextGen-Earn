const { db, admin } = require('../firebase/firebaseAdmin');
const { creditBalance, debitBalance } = require('../services/walletService');
const { buildReferralTree } = require('./userController');

// ─── Dashboard ────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/dashboard
 * Returns aggregated stats: total users, deposits, withdrawals, earnings.
 */
const getDashboard = async (req, res, next) => {
  try {
    const [usersSnap, depositsSnap, withdrawsSnap, txSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('deposits').get(),
      db.collection('withdraws').get(),
      db.collection('transactions').where('type', '==', 'commission').get(),
    ]);

    const totalDeposited = depositsSnap.docs
      .filter((d) => d.data().status === 'approved')
      .reduce((sum, d) => sum + (d.data().amount || 0), 0);

    const totalWithdrawn = withdrawsSnap.docs
      .filter((d) => d.data().status === 'approved')
      .reduce((sum, d) => sum + (d.data().amount || 0), 0);

    const totalCommissions = txSnap.docs.reduce(
      (sum, d) => sum + (d.data().amount || 0),
      0
    );

    return res.json({
      success: true,
      data: {
        totalUsers: usersSnap.size,
        totalDeposited,
        totalWithdrawn,
        totalCommissions,
        pendingDeposits: depositsSnap.docs.filter((d) => d.data().status === 'pending').length,
        pendingWithdraws: withdrawsSnap.docs.filter((d) => d.data().status === 'pending').length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── User Management ──────────────────────────────────────────────────────────

/**
 * GET /api/admin/users
 * Returns all users with their referral count.
 */
const getAllUsers = async (req, res, next) => {
  try {
    const { search } = req.query;
    const snapshot = await db.collection('users').get();
    let users = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: doc.id,
        name: data.name,
        email: data.email,
        referralCode: data.referralCode,
        referredBy: data.referredBy,
        balance: data.balance,
        plan: data.plan,
        totalEarnings: data.totalEarnings,
        isBlocked: data.isBlocked,
        createdAt: data.createdAt,
      };
    });

    // ─── Search Filter ──────────────────────────────────────────────────────
    if (search) {
      const term = search.toLowerCase();
      users = users.filter((u) => 
        (u.email && u.email.toLowerCase().includes(term)) || 
        (u.referralCode && u.referralCode.toLowerCase().includes(term)) ||
        (u.name && u.name.toLowerCase().includes(term))
      );
    }

    // Sort newest first in JS (avoids composite index)
    users.sort((a, b) => {
      const aTime = a.createdAt?._seconds || 0;
      const bTime = b.createdAt?._seconds || 0;
      return bTime - aTime;
    });

    return res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/users/:uid
 * Returns detailed user document.
 */
const getUserDetails = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, data: { uid, ...userDoc.data() } });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/block-user
 * Blocks or unblocks a user.
 * Body: { uid, isBlocked: true | false }
 */
const blockUser = async (req, res, next) => {
  try {
    const { uid, isBlocked } = req.body;

    if (!uid || typeof isBlocked !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'uid and isBlocked (boolean) are required',
      });
    }

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await userRef.update({ isBlocked });

    return res.json({
      success: true,
      message: isBlocked ? 'User blocked successfully' : 'User unblocked successfully',
      data: { uid, isBlocked },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/referrals/:uid
 * Returns the full referral tree for a given user (up to 5 levels).
 */
const getReferralTree = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const referralCode = userDoc.data().referralCode;
    const tree = await buildReferralTree(referralCode, 5);

    return res.json({
      success: true,
      data: {
        uid,
        referralCode,
        tree,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Deposit Management ───────────────────────────────────────────────────────

/**
 * GET /api/admin/deposits
 * Returns all deposits. Optional ?status=pending|approved|rejected
 */
const getDeposits = async (req, res, next) => {
  try {
    const { status } = req.query;
    let query = db.collection('deposits').limit(200);
    if (status) query = query.where('status', '==', status);

    const snapshot = await query.get();
    const deposits = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
    }));

    // Sort newest first in JS
    deposits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ success: true, count: deposits.length, data: deposits });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/deposit/approve
 * Approves or rejects a deposit.
 * Body: { depositId, action: 'approve' | 'reject' }
 */
const handleDeposit = async (req, res, next) => {
  try {
    const { depositId, action } = req.body;
    if (!depositId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'depositId and action (approve|reject) are required',
      });
    }

    const depositRef = db.collection('deposits').doc(depositId);
    const depositDoc = await depositRef.get();
    if (!depositDoc.exists) {
      return res.status(404).json({ success: false, message: 'Deposit not found' });
    }

    const deposit = depositDoc.data();
    if (deposit.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Deposit is already ${deposit.status}`,
      });
    }

    if (action === 'approve') {
      // Credit user balance and write transaction
      await creditBalance(deposit.userId, deposit.amount, 'deposit', {
        depositId,
        method: deposit.method,
        transactionId: deposit.transactionId,
      });
    }

    // Update deposit status
    await depositRef.update({ status: action === 'approve' ? 'approved' : 'rejected' });

    return res.json({
      success: true,
      message: `Deposit ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Withdraw Management ──────────────────────────────────────────────────────

/**
 * GET /api/admin/withdraws
 * Returns all withdrawals. Optional ?status=pending|approved|rejected
 */
const getWithdraws = async (req, res, next) => {
  try {
    const { status } = req.query;
    let query = db.collection('withdraws').limit(200);
    if (status) query = query.where('status', '==', status);

    const snapshot = await query.get();
    const withdraws = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
    }));

    // Sort newest first in JS (avoids composite index requirement)
    withdraws.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ success: true, count: withdraws.length, data: withdraws });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/withdraw/approve
 * Approves or rejects a withdrawal.
 * On approve → deducts balance from user's wallet.
 * Body: { withdrawId, action: 'approve' | 'reject' }
 */
const handleWithdraw = async (req, res, next) => {
  try {
    const { withdrawId, action } = req.body;
    if (!withdrawId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'withdrawId and action (approve|reject) are required',
      });
    }

    const withdrawRef = db.collection('withdraws').doc(withdrawId);
    const withdrawDoc = await withdrawRef.get();
    if (!withdrawDoc.exists) {
      return res.status(404).json({ success: false, message: 'Withdraw not found' });
    }

    const withdraw = withdrawDoc.data();
    if (withdraw.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Withdrawal is already ${withdraw.status}`,
      });
    }

    if (action === 'approve') {
      // Debit balance — validates sufficient funds atomically
      await debitBalance(withdraw.userId, withdraw.amount, 'withdraw', {
        withdrawId,
        method: withdraw.method,
        accountNumber: withdraw.accountNumber,
      });
    }

    // Update withdraw status
    await withdrawRef.update({ status: action === 'approve' ? 'approved' : 'rejected' });

    return res.json({
      success: true,
      message: `Withdrawal ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/set-balance
 * Manually set a user's balance (for admin use/testing).
 * Body: { uid, balance }
 */
const setUserBalance = async (req, res, next) => {
  try {
    const { uid, balance } = req.body;
    if (!uid || balance === undefined) {
      return res.status(400).json({ success: false, message: 'uid and balance required' });
    }
    const balanceNum = parseFloat(balance);
    await db.collection('users').doc(uid).update({ balance: balanceNum });
    return res.json({ success: true, message: `Balance set to ৳${balanceNum}`, data: { uid, balance: balanceNum } });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/set-plan
 * Manually activate a user's plan without charging balance.
 * Body: { uid, plan: 0|1000|2000 }
 */
const setUserPlan = async (req, res, next) => {
  try {
    const { uid, plan } = req.body;
    if (!uid || plan === undefined) {
      return res.status(400).json({ success: false, message: 'uid and plan required' });
    }
    const planNum = parseInt(plan, 10);
    if (![0, 1000, 2000].includes(planNum)) {
      return res.status(400).json({ success: false, message: 'plan must be 0, 1000, or 2000' });
    }
    await db.collection('users').doc(uid).update({ plan: planNum });
    return res.json({ success: true, message: `Plan set to ${planNum}`, data: { uid, plan: planNum } });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboard,
  getAllUsers,
  getUserDetails,
  blockUser,
  getReferralTree,
  getDeposits,
  handleDeposit,
  getWithdraws,
  handleWithdraw,
  setUserBalance,
  setUserPlan,
};
