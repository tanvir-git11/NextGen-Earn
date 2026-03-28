const express = require('express');
const router = express.Router();
const { requestWithdraw, getWithdrawHistory } = require('../controllers/withdrawController');
const authMiddleware = require('../middlewares/authMiddleware');
const blockedCheck = require('../middlewares/blockedCheck');
const { withdrawValidators, handleValidationErrors } = require('../utils/validators');

// POST /api/withdraw
router.post('/', authMiddleware, blockedCheck, withdrawValidators, handleValidationErrors, requestWithdraw);

// GET /api/withdraw/history
router.get('/history', authMiddleware, blockedCheck, getWithdrawHistory);

module.exports = router;
