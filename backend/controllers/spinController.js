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

      // ── COOLDOWN CHECK (2 Hours) ───────────────────────────────────────────
      const COOLDOWN_MS = 2 * 60 * 60 * 1000;
      const now = Date.now();
      const lastSpin = userData.lastSpinTime ? userData.lastSpinTime.toMillis() : 0;
      
      if (now - lastSpin < COOLDOWN_MS) {
        const remainingMin = Math.ceil((COOLDOWN_MS - (now - lastSpin)) / (60 * 1000));
        const err = new Error('COOLDOWN_ACTIVE');
        err.remainingMin = remainingMin;
        throw err;
      }

      if ((userData.availableSpins || 0) < 1) {
        throw new Error('NO_SPINS_AVAILABLE');
      }

      // ── GENERATE RESULT ────────────────────────────────────────────────────
      // Probabilities: 
      // 70% : Lose (৳0)
      // 20% : ৳10
      // 5%  : ৳30
      // 5%  : ৳50
      const rand = Math.random() * 100;
      let reward = 0;
      let prizeIndex = 0;

      if (rand < 70) {
        reward = 0;
        // Map to LOSE segments (0, 2, 4)
        const loseIndices = [0, 2, 4];
        prizeIndex = loseIndices[Math.floor(Math.random() * 3)];
      } else if (rand < 90) { // 20%
        reward = 10;
        prizeIndex = 1; // WIN
      } else if (rand < 95) { // 5%
        reward = 30;
        prizeIndex = 3; // WIN
      } else { // 5%
        reward = 50;
        prizeIndex = 5; // WIN
      }

      // Update user document
      transaction.update(userRef, {
        availableSpins: admin.firestore.FieldValue.increment(-1),
        totalSpins: admin.firestore.FieldValue.increment(1),
        balance: admin.firestore.FieldValue.increment(reward),
        totalEarnings: admin.firestore.FieldValue.increment(reward),
        lastSpinTime: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create transaction record only if reward > 0
      if (reward > 0) {
        const txRef = db.collection('transactions').doc();
        transaction.set(txRef, {
          userId: userData.userId || uid,
          type: 'spin_reward',
          amount: reward,
          status: 'approved',
          meta: { prize: reward },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

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
    if (err.message === 'COOLDOWN_ACTIVE') {
      return res.status(429).json({ success: false, message: `Wait! You can spin again in ${err.remainingMin} minutes.` });
    }
    next(err);
  }
};

module.exports = { playSpinTask };
