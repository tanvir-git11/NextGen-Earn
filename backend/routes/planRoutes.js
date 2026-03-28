const express = require('express');
const router = express.Router();
const { buyPlan, upgradePlan } = require('../controllers/planController');
const authMiddleware = require('../middlewares/authMiddleware');
const blockedCheck = require('../middlewares/blockedCheck');
const { planValidators, handleValidationErrors } = require('../utils/validators');

// POST /api/plan/buy
router.post('/buy', authMiddleware, blockedCheck, planValidators, handleValidationErrors, buyPlan);

// POST /api/plan/upgrade
router.post('/upgrade', authMiddleware, blockedCheck, upgradePlan);

module.exports = router;
