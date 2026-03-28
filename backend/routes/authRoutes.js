const express = require('express');
const router = express.Router();
const { signup, login } = require('../controllers/authController');
const { signupValidators, loginValidators, handleValidationErrors } = require('../utils/validators');

// POST /api/signup
router.post('/signup', signupValidators, handleValidationErrors, signup);

// POST /api/login
router.post('/login', loginValidators, handleValidationErrors, login);

module.exports = router;
