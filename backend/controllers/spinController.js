const { db, admin } = require('../firebase/firebaseAdmin');

/**
 * POST /api/spin
 * Consumes 1 availableSpin and randomly awards BDT based on predefined probabilities.
 * Rewards: 10tk, 20tk, 30tk, 50tk, 100tk
 */
const playSpinTask = async (req, res, next) => {
  try {
    const uid = req.uid;
    const userRef = db.collection('users').doc(uid);
    
    // We must run a transaction because we need to read availableSpins and securely decrement + add reward
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const userData = userDoc.data();

      if (!userData) {
        throw new Error('USER_NOT_FOUND');
      }

      if ((userData.availableSpins || 0) < 1) {
        throw new Error('NO_SPINS_AVAILABLE');
      }

      // Generate random result
      // Probabilities: 10 (50%), 20 (20%), 30 (20%), 50 (6%), 100 (4%)
      const rand = Math.random() * 100;
      let reward = 0;
      let prizeIndex = 0;

      if (rand < 50) {
        reward = 10;
        prizeIndex = 0;
      } else if (rand < 70) {
        reward = 20;
        prizeIndex = 1;
      } else if (rand < 90) {
        reward = 30;
        prizeIndex = 2;
      } else if (rand < 96) {
        reward = 50;
        prizeIndex = 3;
      } else {
        reward = 100;
        prizeIndex = 4;
      }

      // Update user document
      transaction.update(userRef, {
        availableSpins: admin.firestore.FieldValue.increment(-1),
        totalSpins: admin.firestore.FieldValue.increment(1),
        balance: admin.firestore.FieldValue.increment(reward),
        totalEarnings: admin.firestore.FieldValue.increment(reward),
      });

      // Create transaction record
      const txRef = db.collection('transactions').doc();
      transaction.set(txRef, {
        userId: userData.userId || uid,
        type: 'spin_reward',
        amount: reward,
        status: 'approved',
        meta: { prize: reward },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Attach success payload to request so we can send it in response
      req.spinResult = {
        reward,
        prizeIndex,
        newBalance: (userData.balance || 0) + reward,
        spinsLeft: userData.availableSpins - 1
      };
    });

    return res.json({
      success: true,
      message: 'Spin successful',
      data: req.spinResult
    });

  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (err.message === 'NO_SPINS_AVAILABLE') {
      return res.status(403).json({ success: false, message: 'You have NO available spins left! Refer active members to get spins.' });
    }
    next(err);
  }
};

module.exports = { playSpinTask };
