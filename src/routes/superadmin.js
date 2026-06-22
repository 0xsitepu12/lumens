const express = require('express');
const db = require('../db');
const { requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireSuperAdmin);

router.get('/logs', async (req, res) => {
  try {
    const { page, category } = req.query;
    const result = await db.getActivityLogs({ page: parseInt(page) || 1, category });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[superadmin/logs]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
