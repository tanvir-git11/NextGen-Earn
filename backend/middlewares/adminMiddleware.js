/**
 * Middleware: Allows access only to admin users.
 * Admin is identified by: role === 'admin' OR email === ADMIN_EMAIL env var.
 * Must run AFTER authMiddleware (requires req.user to be set).
 */
const adminMiddleware = (req, res, next) => {
  const user = req.user;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const isAdmin =
    user.role === 'admin' || (adminEmail && user.email === adminEmail);

  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Admin access required',
    });
  }

  next();
};

module.exports = adminMiddleware;
