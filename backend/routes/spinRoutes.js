const express = require('express');
const { playSpinTask } = require('../controllers/spinController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// Apply auth middleware to all spin routes
router.use(authMiddleware);

router.post('/', playSpinTask);

module.exports = router;
