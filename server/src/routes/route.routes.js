const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { protect } = require('../middleware/auth');

// Calculate safe route
router.post('/calculate', protect, async (req, res) => {
  try {
    const { startLat, startLng, endLat, endLng } = req.body;

    if (!startLat || !startLng || !endLat || !endLng) {
      return res.status(400).json({
        success: false,
        message: 'Please provide start and end coordinates'
      });
    }

    // Check crimes along the route (simplified - in production use routing API)
    const crimesNearRoute = await query(
      `SELECT COUNT(*) as count, AVG(severity)::DECIMAL(3,2) as avg_severity
       FROM crime_incidents
       WHERE incident_date >= CURRENT_DATE - INTERVAL '30 days'
         AND is_verified = true
         AND (
           ST_DWithin(
             geom,
             ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
             1000
           ) OR
           ST_DWithin(
             geom,
             ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
             1000
           )
         )`,
      [startLng, startLat, endLng, endLat]
    );

    const crimeData = crimesNearRoute.rows[0];
    const riskScore = (parseInt(crimeData.count) * 5 + parseFloat(crimeData.avg_severity || 0) * 10);

    // Calculate distance
    const distance = await query(
      'SELECT calculate_distance($1, $2, $3, $4) as distance_km',
      [startLat, startLng, endLat, endLng]
    );

    // Save route
    const result = await query(
      `INSERT INTO safe_routes 
       (user_id, start_lat, start_lng, end_lat, end_lng, distance_km, risk_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.user.id,
        startLat, startLng, endLat, endLng,
        distance.rows[0].distance_km,
        riskScore
      ]
    );

    res.json({
      success: true,
      data: {
        route: result.rows[0],
        riskLevel: riskScore < 30 ? 'low' : riskScore < 60 ? 'medium' : 'high',
        crimeCount: parseInt(crimeData.count),
        safetyScore: Math.max(0, 100 - riskScore)
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get user's saved routes
router.get('/saved', protect, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM safe_routes 
       WHERE user_id = $1 AND is_saved = true 
       ORDER BY last_used DESC`,
      [req.user.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
