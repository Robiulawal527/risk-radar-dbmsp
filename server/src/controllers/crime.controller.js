const { query } = require('../config/database');
const logger = require('../utils/logger');
const { emitToRole } = require('../services/websocket');

// Get all crimes with filters
exports.getCrimes = async (req, res) => {
  try {
    const {
      type,
      area,
      severity,
      status,
      startDate,
      endDate,
      lat,
      lng,
      radius,
      limit = 500,
      offset = 0
    } = req.query;

    let queryText = `
      SELECT 
        ci.id, ci.crime_type_id, ci.title, ci.description,
        ci.latitude, ci.longitude, ci.incident_date, ci.reported_date,
        ci.severity, ci.status, ci.victims_count, ci.suspects_count,
        ci.is_verified, ci.police_case_number,
        ct.name_en as type_name, ct.name_bn as type_name_bn, ct.color,
        a.name_en as area, a.name_bn as area_bn
      FROM crime_incidents ci
      LEFT JOIN crime_types ct ON ci.crime_type_id = ct.id
      LEFT JOIN areas a ON ci.area_id = a.id
      WHERE ci.is_public = true
    `;

    const params = [];
    let paramCount = 1;

    // Apply filters
    if (type) {
      queryText += ` AND ci.crime_type_id = $${paramCount++}`;
      params.push(type);
    }

    if (area) {
      queryText += ` AND a.name_en ILIKE $${paramCount++}`;
      params.push(`%${area}%`);
    }

    if (severity) {
      queryText += ` AND ci.severity = $${paramCount++}`;
      params.push(severity);
    }

    if (status) {
      queryText += ` AND ci.status = $${paramCount++}`;
      params.push(status);
    }

    if (startDate) {
      queryText += ` AND ci.incident_date >= $${paramCount++}`;
      params.push(startDate);
    }

    if (endDate) {
      queryText += ` AND ci.incident_date <= $${paramCount++}`;
      params.push(endDate);
    }

    // Geographic filter
    if (lat && lng && radius) {
      queryText += ` AND ST_DWithin(
        ci.geom,
        ST_SetSRID(ST_MakePoint($${paramCount++}, $${paramCount++}), 4326)::geography,
        $${paramCount++}
      )`;
      params.push(lng, lat, radius * 1000); // radius in meters
    }

    queryText += ` ORDER BY ci.incident_date DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM crime_incidents ci
      LEFT JOIN areas a ON ci.area_id = a.id
      WHERE ci.is_public = true
    `;
    
    const countParams = params.slice(0, -2); // Remove limit and offset
    const countResult = await query(countQuery, countParams);
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < parseInt(countResult.rows[0].total)
      }
    });

  } catch (error) {
    logger.error('Get crimes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch crimes',
      error: error.message
    });
  }
};

// Get crime by ID
exports.getCrimeById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        ci.*, 
        ct.name_en as type_name, ct.name_bn as type_name_bn, ct.color,
        a.name_en as area, a.name_bn as area_bn,
        u.full_name as reported_by_name
      FROM crime_incidents ci
      LEFT JOIN crime_types ct ON ci.crime_type_id = ct.id
      LEFT JOIN areas a ON ci.area_id = a.id
      LEFT JOIN users u ON ci.reported_by = u.id
      WHERE ci.id = $1 AND ci.is_public = true`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Crime not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Get crime by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch crime',
      error: error.message
    });
  }
};

// Create new crime report
exports.createCrime = async (req, res) => {
  try {
    const {
      crimeTypeId,
      title,
      description,
      latitude,
      longitude,
      incidentDate,
      severity,
      victimsCount,
      suspectsCount,
      policeCaseNumber
    } = req.body;

    // Validation
    if (!crimeTypeId || !title || !latitude || !longitude || !incidentDate || !severity) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Find nearest area
    const areaResult = await query(
      `SELECT id 
       FROM areas 
       ORDER BY ST_Distance(
         geom,
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
       )
       LIMIT 1`,
      [longitude, latitude]
    );

    const areaId = areaResult.rows.length > 0 ? areaResult.rows[0].id : null;

    // Insert crime
    const result = await query(
      `INSERT INTO crime_incidents 
       (crime_type_id, area_id, title, description, latitude, longitude, 
        incident_date, severity, victims_count, suspects_count, 
        police_case_number, reported_by, status, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        crimeTypeId, areaId, title, description || null, latitude, longitude,
        incidentDate, severity, victimsCount || 0, suspectsCount || 0,
        policeCaseNumber || null, req.user.id, 
        req.user.role === 'admin' || req.user.role === 'police' ? 'verified' : 'reported',
        req.user.role === 'admin' || req.user.role === 'police'
      ]
    );

    const crime = result.rows[0];

    // Log activity
    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id)
       VALUES ($1, 'create', 'crime', $2)`,
      [req.user.id, crime.id]
    );

    // Emit to admins/police
    emitToRole('admin', 'crime:new', crime);
    emitToRole('police', 'crime:new', crime);

    logger.info(`New crime reported: ${crime.id} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Crime reported successfully',
      data: crime
    });

  } catch (error) {
    logger.error('Create crime error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to report crime',
      error: error.message
    });
  }
};

// Update crime (admin/police only)
exports.updateCrime = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'title', 'description', 'severity', 'status', 'victims_count',
      'suspects_count', 'police_case_number', 'is_verified', 'is_public'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramCount++}`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(id);

    const result = await query(
      `UPDATE crime_incidents 
       SET ${updates.join(', ')}, verified_by = $${paramCount}
       WHERE id = $${paramCount + 1}
       RETURNING *`,
      [...values, req.user.id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Crime not found'
      });
    }

    // Log activity
    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id)
       VALUES ($1, 'update', 'crime', $2)`,
      [req.user.id, id]
    );

    res.json({
      success: true,
      message: 'Crime updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Update crime error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update crime',
      error: error.message
    });
  }
};

// Delete crime (admin only)
exports.deleteCrime = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM crime_incidents WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Crime not found'
      });
    }

    // Log activity
    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id)
       VALUES ($1, 'delete', 'crime', $2)`,
      [req.user.id, id]
    );

    res.json({
      success: true,
      message: 'Crime deleted successfully'
    });

  } catch (error) {
    logger.error('Delete crime error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete crime',
      error: error.message
    });
  }
};

// Get crime types
exports.getCrimeTypes = async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM crime_types WHERE is_active = true ORDER BY name_en`
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    logger.error('Get crime types error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch crime types',
      error: error.message
    });
  }
};

// Get crimes within radius
exports.getCrimesNearby = async (req, res) => {
  try {
    const { lat, lng, radius = 5 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Please provide latitude and longitude'
      });
    }

    const result = await query(
      `SELECT * FROM get_crimes_within_radius($1, $2, $3)`,
      [lat, lng, radius]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    logger.error('Get nearby crimes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch nearby crimes',
      error: error.message
    });
  }
};
