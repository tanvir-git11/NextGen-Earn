const { db } = require('../firebase/firebaseAdmin');

/**
 * GET /api/settings
 * Publicly accessible settings like min deposit, min withdraw.
 */
const getSettings = async (req, res, next) => {
  try {
    const settingsDoc = await db.collection('settings').doc('config').get();
    
    if (!settingsDoc.exists) {
      // Return defaults if not configured
      return res.json({
        success: true,
        data: {
          minDeposit: 100,
          minWithdraw: 500,
          updatedAt: new Date().toISOString()
        }
      });
    }

    return res.json({
      success: true,
      data: settingsDoc.data()
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/settings
 * Admin-only: update global settings.
 */
const updateSettings = async (req, res, next) => {
  try {
    const { minDeposit, minWithdraw, bkashNumber, nagadNumber, isAutoPaymentEnabled } = req.body;
    
    const updates = {};
    if (minDeposit !== undefined) updates.minDeposit = parseFloat(minDeposit);
    if (minWithdraw !== undefined) updates.minWithdraw = parseFloat(minWithdraw);
    if (bkashNumber !== undefined) updates.bkashNumber = String(bkashNumber).trim();
    if (nagadNumber !== undefined) updates.nagadNumber = String(nagadNumber).trim();
    if (isAutoPaymentEnabled !== undefined) updates.isAutoPaymentEnabled = !!isAutoPaymentEnabled;
    
    updates.updatedAt = new Date().toISOString();

    await db.collection('settings').doc('config').set(updates, { merge: true });

    return res.json({
      success: true,
      message: 'Settings updated successfully',
      data: updates
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSettings,
  updateSettings
};
