const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { protect, authorize } = require('../middleware/auth');
const { emitToRole } = require('../services/websocket');

// Create SOS alert
router.post('/sos', protect, async (req, res) => {
  try {
    const { latitude, longitude, emergencyType, message } = req.body;

    const result = await query(
      `INSERT INTO emergency_sos 
       (user_id, latitude, longitude, emergency_type, message, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING *`,
      [req.user.id, latitude, longitude, emergencyType || 'general', message || '']
    );

    const sos = result.rows[0];

    // Emit to police/admin
    emitToRole('police', 'emergency:new', sos);
    emitToRole('admin', 'emergency:new', sos);

    res.status(201).json({
      success: true,
      message: 'SOS alert sent successfully',
      data: sos
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get active SOS alerts (police/admin)
router.get('/sos/active', protect, authorize('police', 'admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT e.*, u.full_name, u.phone
       FROM emergency_sos e
       JOIN users u ON e.user_id = u.id
       WHERE e.status = 'active'
       ORDER BY e.created_at DESC`
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update SOS status (police/admin)
router.put('/sos/:id', protect, authorize('police', 'admin'), async (req, res) => {
  try {
    const { status } = req.body;

    const result = await query(
      `UPDATE emergency_sos 
       SET status = $1, responded_by = $2, resolved_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [status, req.user.id, req.params.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
