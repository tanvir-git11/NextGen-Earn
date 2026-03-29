const express = require('express');
const router = express.Router();
const { checkoutDeposit, verifyDeposit, getDepositHistory, submitManualDeposit } = require('../controllers/depositController');
const authMiddleware = require('../middlewares/authMiddleware');
const blockedCheck = require('../middlewares/blockedCheck');
const { depositValidators, handleValidationErrors } = require('../utils/validators');

// POST /api/deposit/checkout
router.post('/checkout', authMiddleware, blockedCheck, depositValidators, handleValidationErrors, checkoutDeposit);

// POST /api/deposit/verify
router.post('/verify', authMiddleware, blockedCheck, verifyDeposit);

// POST /api/deposit/manual
router.post('/manual', authMiddleware, blockedCheck, submitManualDeposit);

// GET /api/deposit/history
router.get('/history', authMiddleware, blockedCheck, getDepositHistory);

module.exports = router;
