const express = require('express');
const router = express.Router();
const { getSettings } = require('../controllers/settingsController');

// GET /api/settings
// Publicly accessible current limits
router.get('/', getSettings);

module.exports = router;
