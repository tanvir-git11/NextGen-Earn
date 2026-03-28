const { db } = require('../firebase/firebaseAdmin');

/**
 * GET /api/wallet
 * Returns the user's current balance and total earnings.
 */
const getWallet = async (req, res, next) => {
  try {
    const { balance, totalEarnings, plan, availableSpins, totalSpins } = req.user;
    return res.json({
      success: true,
      data: { balance, totalEarnings, plan, availableSpins, totalSpins },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/transactions
 * Returns the user's complete transaction history, newest first.
 */
const getTransactions = async (req, res, next) => {
  try {
    const uid = req.uid;
    const snapshot = await db
      .collection('transactions')
      .where('userId', '==', uid)
      .limit(100)
      .get();

    const transactions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
    }));

    // Sort newest first in JS (avoids needing a Firestore composite index)
    transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getWallet, getTransactions };
