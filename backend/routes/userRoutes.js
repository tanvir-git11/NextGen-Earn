const express = require('express');
const router = express.Router();
const { getProfile, getReferrals, getReferrerProfile, updateProfile, getUserLevel } = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const blockedCheck = require('../middlewares/blockedCheck');

// GET /api/user/profile
router.get('/profile', authMiddleware, blockedCheck, getProfile);

// GET /api/user/level
router.get('/level', authMiddleware, blockedCheck, getUserLevel);

// GET /api/user/referrals
router.get('/referrals', authMiddleware, blockedCheck, getReferrals);

// GET /api/user/referrer/:code
router.get('/referrer/:code', authMiddleware, blockedCheck, getReferrerProfile);

// PUT /api/user/profile
router.put('/profile', authMiddleware, blockedCheck, updateProfile);

module.exports = router;
