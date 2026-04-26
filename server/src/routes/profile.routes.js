const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { protect, authorize } = require('../middleware/auth');

router.get('/criminals/ranking', protect, async (req, res) => {
  try {
    const result = await query(
      `SELECT cp.id, cp.display_name, cp.alias, cp.severity_score, cp.incident_count,
              cp.last_seen_at, cp.status, cp.public_summary,
              ct.name_en as primary_crime_type, ct.name_bn as primary_crime_type_bn,
              a.name_en as known_area, a.name_bn as known_area_bn
       FROM criminal_profiles cp
       LEFT JOIN crime_types ct ON cp.primary_crime_type_id = ct.id
       LEFT JOIN areas a ON cp.known_area_id = a.id
       ORDER BY cp.severity_score DESC, cp.incident_count DESC, cp.last_seen_at DESC NULLS LAST
       LIMIT 50`
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/criminals', protect, authorize('admin', 'police'), async (req, res) => {
  try {
    const {
      displayName,
      alias,
      primaryCrimeTypeId,
      knownAreaId,
      severityScore,
      incidentCount,
      lastSeenAt,
      status,
      publicSummary
    } = req.body;

    if (!displayName) {
      return res.status(400).json({ success: false, message: 'displayName is required' });
    }

    const result = await query(
      `INSERT INTO criminal_profiles
       (display_name, alias, primary_crime_type_id, known_area_id, severity_score,
        incident_count, last_seen_at, status, public_summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'wanted'), $9)
       RETURNING *`,
      [
        displayName,
        alias || null,
        primaryCrimeTypeId || null,
        knownAreaId || null,
        severityScore || 0,
        incidentCount || 0,
        lastSeenAt || null,
        status || null,
        publicSummary || null
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/victims', protect, authorize('admin', 'police'), async (req, res) => {
  try {
    const result = await query(
      `SELECT vp.*, ci.title as incident_title, ci.incident_date
       FROM victim_profiles vp
       LEFT JOIN crime_incidents ci ON vp.crime_incident_id = ci.id
       ORDER BY vp.created_at DESC
       LIMIT 100`
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/victims', protect, authorize('admin', 'police'), async (req, res) => {
  try {
    const { userId, crimeIncidentId, fullName, phone, supportStatus, privacyLevel, notes } = req.body;

    const result = await query(
      `INSERT INTO victim_profiles
       (user_id, crime_incident_id, full_name, phone, support_status, privacy_level, notes)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'new'), COALESCE($6, 'private'), $7)
       RETURNING *`,
      [userId || null, crimeIncidentId || null, fullName || null, phone || null, supportStatus || null, privacyLevel || null, notes || null]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/volunteers/me', protect, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM volunteer_profiles WHERE user_id = $1',
      [req.user.id]
    );

    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/volunteers/me', protect, async (req, res) => {
  try {
    const { skills, serviceAreas, availability, emergencyContact, notes } = req.body;

    const result = await query(
      `INSERT INTO volunteer_profiles
       (user_id, skills, service_areas, availability, emergency_contact, notes)
       VALUES ($1, $2, $3, COALESCE($4, 'on_call'), $5, $6)
       ON CONFLICT (user_id)
       DO UPDATE SET
         skills = EXCLUDED.skills,
         service_areas = EXCLUDED.service_areas,
         availability = EXCLUDED.availability,
         emergency_contact = EXCLUDED.emergency_contact,
         notes = EXCLUDED.notes
       RETURNING *`,
      [req.user.id, skills || [], serviceAreas || [], availability || null, emergencyContact || null, notes || null]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
