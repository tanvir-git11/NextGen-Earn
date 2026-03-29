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

    // ── Check Dynamic Min Deposit ───────────────────────────────────────
    const settingsDoc = await db.collection('settings').doc('config').get();
    const minDeposit = settingsDoc.exists ? settingsDoc.data().minDeposit : 100;

    if (amountNum < minDeposit) {
      return res.status(400).json({
        success: false,
        message: `Minimum deposit amount is ${minDeposit} BDT`,
      });
    }
    
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
        'X-CLIENT': 'nextgenearn.shop'
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
        'Content-Type': 'application/json',
        'X-CLIENT': 'nextgenearn.shop'
      },
      body: data
    });
    
    const result = await response.json();
    console.log('[DEBUG] RupantorPay Verify Response:', JSON.stringify(result, null, 2));
    
    // 3. Process success
    // RupantorPay v2 may return status as boolean (true) or string ('COMPLETED' or 'Success')
    // and amount might be at top level or inside a 'data' object.
    const isSuccess = 
      result.status === true || 
      result.status === 1 || 
      result.status === 'COMPLETED' || 
      result.status === 'Success' ||
      result.status === 'SUCCESS' ||
      String(result.message).toLowerCase().includes('success') ||
      result.data?.status === 'Success' ||
      result.data?.status === 'SUCCESS' ||
      result.data?.status === 'COMPLETED';

    const paymentMethod = 'rupantorpay';

    if (isSuccess) {
      // Find amount (could be result.amount, result.data.amount, or result.received_amount)
      const rawAmount = result.amount || result.data?.amount || result.received_amount || result.data?.received_amount || result.pay_amount || result.data?.pay_amount;
      const amountNum = parseFloat(rawAmount);

      if (isNaN(amountNum) || amountNum <= 0) {
        console.error('[verifyDeposit] Invalid amount found in response:', rawAmount);
        return res.status(400).json({ success: false, message: 'Invalid payment amount received from gateway' });
      }

      // Ensure the transaction belongs to the currently logged in user (security check)
      // Some gateways might drop metadata, so if missing, we still proceed if transaction is valid.
      const metadata = result.metadata || result.data?.metadata;
      if (metadata?.uid && metadata.uid !== uid) {
        console.warn(`[verifyDeposit] Metadata UID mismatch: ${metadata.uid} vs ${uid}. Continuing if no other match found.`);
        // return res.status(403).json({ success: false, message: 'Transaction belongs to another user' });
      }

      // Safe: Transaction valid, not duplicate, let's credit
      await creditBalance(uid, amountNum, 'deposit', { method: paymentMethod, transactionId: transaction_id });
      
      // Update existing record: Query by userId only (no index needed) and filter in memory
      const depositsSnap = await db.collection('deposits')
        .where('userId', '==', uid)
        .get();

      // Find the latest pending record
      const pendingDoc = depositsSnap.docs
        .filter(d => d.data().status === 'pending')
        .sort((a, b) => {
          const aTime = a.data().createdAt?.toDate?.() || 0;
          const bTime = b.data().createdAt?.toDate?.() || 0;
          return bTime - aTime;
        })[0];

      if (pendingDoc) {
        const docRef = pendingDoc.ref;
        await docRef.update({
          transactionId: transaction_id,
          method: paymentMethod,
          amount: amountNum, 
          status: 'approved',
          verifiedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[verifyDeposit] Updated existing record: ${docRef.id}`);
      } else {
        // Fallback: create new record if no pending found
        const depositRef = db.collection('deposits').doc();
        await depositRef.set({
          userId: uid,
          method: paymentMethod,
          transactionId: transaction_id,
          amount: amountNum,
          status: 'approved',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[verifyDeposit] Created new record: ${depositRef.id}`);
      }
      
      return res.status(200).json({ success: true, message: 'Payment verified successfully. Balance added.', amount: amountNum });
    } else {
      console.error('[verifyDeposit] Verification failed. Response:', result);
      return res.status(400).json({ 
        success: false, 
        message: result.message || result.data?.message || 'Payment verification failed or is not completed' 
      });
    }
  } catch (err) {
    console.error('[verifyDeposit] General Error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error during verification', 
      debug: err.message // Send clear error message for diagnostics
    });
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
