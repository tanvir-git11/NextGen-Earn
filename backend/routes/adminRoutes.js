const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getAllUsers,
  getUserDetails,
  blockUser,
  getReferralTree,
  getDeposits,
  handleDeposit,
  getWithdraws,
  handleWithdraw,
  setUserBalance,
  setUserPlan,
} = require('../controllers/adminController');
const { getSettings, updateSettings } = require('../controllers/settingsController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');

// Apply auth + admin check to ALL admin routes
router.use(authMiddleware, adminMiddleware);

// Dashboard
router.get('/dashboard', getDashboard);

// User Management
router.get('/users', getAllUsers);
router.get('/users/:uid', getUserDetails);
router.patch('/block-user', blockUser);
router.patch('/set-balance', setUserBalance);
router.patch('/set-plan', setUserPlan);
router.get('/referrals/:uid', getReferralTree);

// Deposit Control
router.get('/deposits', getDeposits);
router.post('/deposit/approve', handleDeposit);

// Withdraw Control
router.get('/withdraws', getWithdraws);
router.post('/withdraw/approve', handleWithdraw);

// Global Settings Control
router.get('/settings', getSettings);
router.patch('/settings', updateSettings);

module.exports = router;
