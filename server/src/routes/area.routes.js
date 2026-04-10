const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { optionalAuth } = require('../middleware/auth');

// Get all areas
router.get('/', optionalAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT a.*, 
              calculate_area_risk_score(a.id) as risk_score,
              COUNT(ci.id) as crime_count
       FROM areas a
       LEFT JOIN crime_incidents ci ON a.id = ci.area_id 
         AND ci.incident_date >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY a.id
       ORDER BY a.name_en`
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get area by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT a.*, 
              calculate_area_risk_score(a.id) as risk_score
       FROM areas a WHERE a.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Area not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get high-risk areas
router.get('/risk/high', optionalAuth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_high_risk_areas LIMIT 20');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
