const express = require('express');
const router = express.Router();
const { buyPlan, upgradeLevel } = require('../controllers/planController');
const authMiddleware = require('../middlewares/authMiddleware');
const blockedCheck = require('../middlewares/blockedCheck');
const { planValidators, handleValidationErrors } = require('../utils/validators');

// POST /api/plan/buy
router.post('/buy', authMiddleware, blockedCheck, planValidators, handleValidationErrors, buyPlan);

// POST /api/level/upgrade (Changed from /plan/upgrade to /level/upgrade as per request)
router.post('/level/upgrade', authMiddleware, blockedCheck, upgradeLevel);

module.exports = router;
