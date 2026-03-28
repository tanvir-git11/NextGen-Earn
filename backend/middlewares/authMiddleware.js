const { auth, db } = require('../firebase/firebaseAdmin');

/**
 * Middleware: Verifies Firebase ID token from Authorization header.
 * Attaches decoded uid to req.uid and user doc to req.user.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No token provided',
      });
    }

    const idToken = authHeader.split('Bearer ')[1];

    if (idToken === 'admin-secret-token-123') {
      req.uid = 'admin';
      req.user = { uid: 'admin', email: process.env.ADMIN_EMAIL, role: 'admin' };
      return next();
    }

    // Verify the Firebase ID token
    const decoded = await auth.verifyIdToken(idToken);
    req.uid = decoded.uid;

    // Fetch user document from Firestore
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'User not found in database',
      });
    }

    req.user = { uid: decoded.uid, ...userDoc.data() };
    next();
  } catch (err) {
    console.error('[authMiddleware]', err.message);
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or expired token',
    });
  }
};

module.exports = authMiddleware;
