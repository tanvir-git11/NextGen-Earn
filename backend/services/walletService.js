const { db, admin } = require('../firebase/firebaseAdmin');

/**
 * Credits a user's balance and writes a transaction record.
 *
 * @param {string} uid    - User UID
 * @param {number} amount - Amount to credit
 * @param {string} type   - Transaction type: 'deposit' | 'commission' | 'refund'
 * @param {object} meta   - Optional metadata (e.g., depositId, method)
 */
const creditBalance = async (uid, amount, type = 'deposit', meta = {}) => {
  if (amount <= 0) throw new Error('Credit amount must be positive');

  const batch = db.batch();

  // Increment user balance
  const userRef = db.collection('users').doc(uid);
  batch.update(userRef, {
    balance: admin.firestore.FieldValue.increment(amount),
  });

  // Write transaction log
  const txRef = db.collection('transactions').doc();
  batch.set(txRef, {
    userId: uid,
    type,
    amount,
    status: 'approved',
    meta,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();
};

/**
 * Debits a user's balance after validating sufficient funds.
 * Prevents negative balance.
 *
 * @param {string} uid    - User UID
 * @param {number} amount - Amount to debit
 * @param {string} type   - Transaction type: 'withdraw'
 * @param {object} meta   - Optional metadata
 */
const debitBalance = async (uid, amount, type = 'withdraw', meta = {}) => {
  if (amount <= 0) throw new Error('Debit amount must be positive');

  // Read current balance inside a Firestore transaction for safety
  await db.runTransaction(async (t) => {
    const userRef = db.collection('users').doc(uid);
    const userDoc = await t.get(userRef);

    if (!userDoc.exists) throw new Error('User not found');

    const currentBalance = userDoc.data().balance || 0;
    if (currentBalance < amount) {
      throw new Error('Insufficient balance');
    }

    // Deduct balance
    t.update(userRef, {
      balance: admin.firestore.FieldValue.increment(-amount),
    });

    // Write transaction log
    const txRef = db.collection('transactions').doc();
    t.set(txRef, {
      userId: uid,
      type,
      amount,
      status: 'approved',
      meta,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
};

module.exports = { creditBalance, debitBalance };
