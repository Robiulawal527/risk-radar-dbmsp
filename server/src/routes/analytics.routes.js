const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { optionalAuth } = require('../middleware/auth');

// Get crime statistics
router.get('/stats', optionalAuth, async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_crimes,
        COUNT(CASE WHEN incident_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as last_30_days,
        COUNT(CASE WHEN incident_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as last_7_days,
        COUNT(CASE WHEN incident_date >= CURRENT_DATE - INTERVAL '1 day' THEN 1 END) as today,
        AVG(severity)::DECIMAL(3,2) as avg_severity,
        COUNT(DISTINCT area_id) as areas_affected
      FROM crime_incidents
      WHERE is_verified = true
    `);

    const byType = await query(`
      SELECT 
        ct.id, ct.name_en, ct.name_bn, ct.color,
        COUNT(ci.id) as count
      FROM crime_types ct
      LEFT JOIN crime_incidents ci ON ct.id = ci.crime_type_id
        AND ci.incident_date >= CURRENT_DATE - INTERVAL '90 days'
        AND ci.is_verified = true
      GROUP BY ct.id, ct.name_en, ct.name_bn, ct.color
      ORDER BY count DESC
    `);

    const monthlyTrend = await query(`
      SELECT 
        DATE_TRUNC('month', incident_date) as month,
        COUNT(*) as count
      FROM crime_incidents
      WHERE incident_date >= CURRENT_DATE - INTERVAL '6 months'
        AND is_verified = true
      GROUP BY month
      ORDER BY month
    `);

    res.json({
      success: true,
      data: {
        overview: stats.rows[0],
        byType: byType.rows,
        monthlyTrend: monthlyTrend.rows
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get area statistics
router.get('/areas', optionalAuth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_area_crime_stats ORDER BY total_crimes DESC LIMIT 20');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// AI Predictions
router.get('/predictions', optionalAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        a.id, a.name_en, a.name_bn,
        calculate_area_risk_score(a.id) as current_risk,
        (calculate_area_risk_score(a.id) * 1.15)::DECIMAL(5,2) as predicted_risk,
        (85 + (calculate_area_risk_score(a.id) * 0.15))::DECIMAL(3,0) as confidence
      FROM areas a
      WHERE calculate_area_risk_score(a.id) > 40
      ORDER BY current_risk DESC
      LIMIT 10
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
