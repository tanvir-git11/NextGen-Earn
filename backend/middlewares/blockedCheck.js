/**
 * Middleware: Blocks access if the authenticated user is blocked.
 * Must run AFTER authMiddleware (requires req.user to be set).
 */
const blockedCheck = (req, res, next) => {
  if (req.user && req.user.isBlocked === true) {
    return res.status(403).json({
      success: false,
      message: 'Your account has been blocked. Please contact support.',
    });
  }
  next();
};

module.exports = blockedCheck;
