const express = require('express');
const router = express.Router();
const { getWallet, getTransactions } = require('../controllers/walletController');
const authMiddleware = require('../middlewares/authMiddleware');
const blockedCheck = require('../middlewares/blockedCheck');

// GET /api/wallet
router.get('/wallet', authMiddleware, blockedCheck, getWallet);

// GET /api/transactions
router.get('/transactions', authMiddleware, blockedCheck, getTransactions);

module.exports = router;
