const { auth, db } = require('../firebase/firebaseAdmin');
const generateReferralCode = require('../utils/generateReferralCode');
const fetch = require('node-fetch');

/**
 * POST /api/signup
 * Creates a new Firebase Auth user and Firestore document.
 * Optionally accepts a referralCode from an existing user.
 */
const signup = async (req, res, next) => {
  try {
    const { name, email, password, referralCode: inputReferralCode } = req.body;

    // ── Resolve referredBy using referralCode ──────────────────────────────
    let referredBy = null;
    if (inputReferralCode) {
      if (!/^\d{8}$/.test(inputReferralCode)) {
        return res.status(400).json({
          success: false,
          message: 'Referral code must be an 8-digit number',
        });
      }
      const refSnapshot = await db
        .collection('users')
        .where('referralCode', '==', inputReferralCode)
        .limit(1)
        .get();

      if (refSnapshot.empty) {
        return res.status(400).json({
          success: false,
          message: 'Invalid referral code',
        });
      }
      referredBy = inputReferralCode;
    }

    // ── Create Firebase Auth user ──────────────────────────────────────────
    let firebaseUser;
    try {
      firebaseUser = await auth.createUser({
        email,
        password,
        displayName: name,
      });
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        return res.status(409).json({
          success: false,
          message: 'Email is already registered',
        });
      }
      throw err;
    }

    // ── Generate unique referral code for this new user ────────────────────
    const newReferralCode = await generateReferralCode();

    // ── Save user document to Firestore ────────────────────────────────────
    const userDoc = {
      uid: firebaseUser.uid,
      userId: newReferralCode, // strict sequential numeric ID
      name,
      email,
      referralCode: newReferralCode,
      referredBy,          // referralCode of the parent, or null
      balance: 0,
      // Signup doc update
      plan: 0,
      level: 0,
      availableSpins: 0,
      totalSpins: 0,
      totalEarnings: 0,
      isBlocked: false,
      role: 'user',
      createdAt: new Date().toISOString(),
    };

    await db.collection('users').doc(firebaseUser.uid).set(userDoc);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        uid: firebaseUser.uid,
        userId: newReferralCode,
        name,
        email,
        referralCode: newReferralCode,
        referredBy,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/login
 * Authenticates via Firebase Auth REST API and returns an ID token.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // ── Admin Hardcoded Login Bypass ───────────────────────────────────────
    if (email === process.env.ADMIN_EMAIL) {
      if (password === process.env.ADMIN_PASS) {
        return res.json({
          success: true,
          message: 'Admin login successful',
          data: {
            idToken: 'admin-secret-token-123',
            uid: 'admin',
            email: process.env.ADMIN_EMAIL,
            role: 'admin',
          },
        });
      } else {
        return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
      }
    }

    // ── Authenticate via Firebase Auth REST API ────────────────────────────
    const apiKey = process.env.FIREBASE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Server misconfiguration: FIREBASE_API_KEY not set',
      });
    }

    const firebaseAuthUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
    const response = await fetch(firebaseAuthUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });

    const authResult = await response.json();
    if (!response.ok) {
      const errorCode = authResult?.error?.message || 'INVALID_CREDENTIALS';
      const messages = {
        EMAIL_NOT_FOUND: 'No account found with this email',
        INVALID_PASSWORD: 'Incorrect password',
        INVALID_LOGIN_CREDENTIALS: 'Invalid email or password',
        USER_DISABLED: 'This account has been disabled',
      };
      return res.status(401).json({
        success: false,
        message: messages[errorCode] || 'Login failed',
      });
    }

    const { idToken, localId: uid, expiresIn } = authResult;

    // ── Check if user is blocked in Firestore ──────────────────────────────
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userData = userDoc.data();
    if (userData.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked. Contact support.',
      });
    }

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        idToken,
        uid,
        userId: userData.userId,
        expiresIn,
        name: userData.name,
        email: userData.email,
        referralCode: userData.referralCode,
        referredBy: userData.referredBy || null,
        availableSpins: userData.availableSpins || 0,
        totalSpins: userData.totalSpins || 0,
        plan: userData.plan,
        level: userData.level || 0,
        balance: userData.balance,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { signup, login };
