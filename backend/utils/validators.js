const { body, validationResult } = require('express-validator');

/**
 * Returns validation errors as a 422 response if any exist.
 * Must be used after validator chains as middleware.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

// ─── Signup Validators ────────────────────────────────────────────────────────
const signupValidators = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('referralCode')
    .optional()
    .trim()
    .isAlphanumeric()
    .withMessage('Referral code must be alphanumeric'),
];

// ─── Login Validators ─────────────────────────────────────────────────────────
const loginValidators = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// ─── Deposit Validators ───────────────────────────────────────────────────────
const depositValidators = [
  body('amount')
    .isFloat()
    .withMessage('Amount must be a number'),
];

// ─── Withdraw Validators ──────────────────────────────────────────────────────
const withdrawValidators = [
  body('method')
    .isIn(['bkash', 'nagad'])
    .withMessage('Method must be bkash or nagad'),
  body('accountNumber').trim().notEmpty().withMessage('Account number is required'),
  body('amount')
    .isFloat()
    .withMessage('Amount must be a positive number'),
];

// ─── Plan Buy Validators ──────────────────────────────────────────────────────
const planValidators = [
  body('plan')
    .custom((value) => {
      const parsed = parseInt(value, 10);
      if (parsed !== 1000 && parsed !== 2000) {
        throw new Error('Plan must be 1000 or 2000');
      }
      return true;
    }),
];

module.exports = {
  handleValidationErrors,
  signupValidators,
  loginValidators,
  depositValidators,
  withdrawValidators,
  planValidators,
};
