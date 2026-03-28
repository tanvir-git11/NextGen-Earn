const express = require('express');
const router = express.Router();
const { getProfile, getReferrals, getReferrerProfile } = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const blockedCheck = require('../middlewares/blockedCheck');

// GET /api/user/profile
router.get('/profile', authMiddleware, blockedCheck, getProfile);

// GET /api/user/referrals
router.get('/referrals', authMiddleware, blockedCheck, getReferrals);

// GET /api/user/referrer/:code
router.get('/referrer/:code', authMiddleware, blockedCheck, getReferrerProfile);

// PUT /api/user/profile
router.put('/profile', authMiddleware, blockedCheck, require('../controllers/userController').updateProfile);

module.exports = router;
