const { db, admin } = require('../firebase/firebaseAdmin');
const { creditBalance } = require('../services/walletService');

/**
 * POST /api/deposit/checkout
 * Generates a RupantorPay checkout URL and returns it.
 */
const checkoutDeposit = async (req, res, next) => {
  try {
    const uid = req.uid;
    const { amount } = req.body;
    const amountNum = parseFloat(amount);
    
    // Convert to string for RupantorPay
    const data = JSON.stringify({
      success_url: `${process.env.CLIENT_URL || 'http://localhost:8080'}/index.html?payment=success`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:8080'}/index.html?payment=cancel`,
      webhook_url: `${process.env.CLIENT_URL || 'http://localhost:8080'}/api/deposit/webhook`, // Dummy for now
      metadata: { uid },
      amount: amountNum.toString()
    });

    const apiKey = process.env.RUPANTOR_API_KEY || '';
    
    const response = await fetch('https://payment.rupantorpay.com/api/payment/checkout', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
        'X-CLIENT': 'localhost'
      },
      body: data
    });
    
    const result = await response.json();
    
    if ((result.status === 1 || result.status === true) && result.payment_url) {
      // Record a pending intent in the db briefly
      const depositRef = db.collection('deposits').doc();
      await depositRef.set({
        userId: uid,
        method: 'rupantorpay',
        amount: amountNum,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      return res.status(200).json({
        success: true,
        payment_url: result.payment_url
      });
    } else {
      console.error('[checkoutDeposit] Failed to get payment link:', result);
      return res.status(400).json({ success: false, message: result.message || 'Failed to generate payment link' });
    }
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/deposit/verify
 * Verifies a transaction code from RupantorPay and credits balance.
 */
const verifyDeposit = async (req, res, next) => {
  try {
    const uid = req.uid;
    const { transaction_id } = req.body;
    if (!transaction_id) {
      return res.status(400).json({ success: false, message: 'Missing transaction ID' });
    }

    // 1. Check if already processed
    const dupCheck = await db.collection('deposits').where('transactionId', '==', transaction_id).limit(1).get();
    if (!dupCheck.empty) {
      return res.status(409).json({ success: false, message: 'Transaction already verified and credited' });
    }

    // 2. Call RupantorPay verify API
    const data = JSON.stringify({ transaction_id });
    const response = await fetch('https://payment.rupantorpay.com/api/payment/verify-payment', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.RUPANTOR_API_KEY || '',
        'Content-Type': 'application/json'
      },
      body: data
    });
    
    const result = await response.json();
    
    // 3. Process success
    if (result.status === 'COMPLETED') {
      const amountNum = parseFloat(result.amount);
      const paymentMethod = result.payment_method || 'rupantorpay';
      
      // Ensure the transaction belongs to the currently logged in user (security check)
      if (result.metadata?.uid && result.metadata.uid !== uid) {
        return res.status(403).json({ success: false, message: 'Transaction belongs to another user' });
      }

      // Safe: Transaction valid, not duplicate, let's credit
      await creditBalance(uid, amountNum, 'deposit', { method: paymentMethod, transactionId: transaction_id });
      
      // Save it explicitly as a deposit record so it appears in deposit history
      const depositRef = db.collection('deposits').doc();
      await depositRef.set({
        userId: uid,
        method: paymentMethod,
        transactionId: transaction_id,
        amount: amountNum,
        status: 'approved', // Auto-approved
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      return res.status(200).json({ success: true, message: 'Payment verified successfully. Balance added.', amount: amountNum });
    } else {
      return res.status(400).json({ success: false, message: 'Payment verification failed or is not completed' });
    }
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/deposit/history
 * Returns the authenticated user's deposit history.
 */
const getDepositHistory = async (req, res, next) => {
  try {
    const uid = req.uid;
    const snapshot = await db
      .collection('deposits')
      .where('userId', '==', uid)
      .limit(50)
      .get();

    const deposits = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
    }));

    deposits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ success: true, count: deposits.length, data: deposits });
  } catch (err) {
    next(err);
  }
};

module.exports = { checkoutDeposit, verifyDeposit, getDepositHistory };
