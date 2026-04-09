-- ============================================
-- RISK RADAR DATABASE SCHEMA
-- PostgreSQL Database for Crime Tracking System
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- For geospatial data

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'police')),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    profile_image TEXT,
    preferences JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================
-- CRIME TYPES TABLE
-- ============================================
CREATE TABLE crime_types (
    id VARCHAR(50) PRIMARY KEY,
    name_en VARCHAR(100) NOT NULL,
    name_bn VARCHAR(100) NOT NULL,
    description_en TEXT,
    description_bn TEXT,
    color VARCHAR(7) NOT NULL, -- Hex color code
    icon VARCHAR(50),
    severity_base INTEGER DEFAULT 3 CHECK (severity_base BETWEEN 1 AND 5),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- AREAS/LOCATIONS TABLE
-- ============================================
CREATE TABLE areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_en VARCHAR(255) NOT NULL,
    name_bn VARCHAR(255) NOT NULL,
    district VARCHAR(100) NOT NULL,
    division VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    geom GEOGRAPHY(POINT, 4326), -- PostGIS geometry
    population INTEGER,
    area_sq_km DECIMAL(10, 2),
    police_station VARCHAR(255),
    risk_category VARCHAR(20) CHECK (risk_category IN ('low', 'medium', 'high', 'critical')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_areas_geom ON areas USING GIST(geom);
CREATE INDEX idx_areas_district ON areas(district);
CREATE INDEX idx_areas_risk_category ON areas(risk_category);

-- ============================================
-- CRIME INCIDENTS TABLE
-- ============================================
CREATE TABLE crime_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crime_type_id VARCHAR(50) NOT NULL REFERENCES crime_types(id),
    area_id UUID REFERENCES areas(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    geom GEOGRAPHY(POINT, 4326), -- PostGIS geometry
    incident_date TIMESTAMP NOT NULL,
    reported_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    severity INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 5),
    status VARCHAR(20) NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'investigating', 'resolved', 'closed', 'verified')),
    victims_count INTEGER DEFAULT 0,
    suspects_count INTEGER DEFAULT 0,
    reported_by UUID REFERENCES users(id),
    verified_by UUID REFERENCES users(id),
    police_case_number VARCHAR(100),
    is_verified BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_crime_incidents_geom ON crime_incidents USING GIST(geom);
CREATE INDEX idx_crime_incidents_date ON crime_incidents(incident_date);
CREATE INDEX idx_crime_incidents_type ON crime_incidents(crime_type_id);
CREATE INDEX idx_crime_incidents_status ON crime_incidents(status);
CREATE INDEX idx_crime_incidents_severity ON crime_incidents(severity);
CREATE INDEX idx_crime_incidents_area ON crime_incidents(area_id);

-- ============================================
-- USER LOCATIONS (Real-time tracking)
-- ============================================
CREATE TABLE user_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    geom GEOGRAPHY(POINT, 4326),
    accuracy DECIMAL(10, 2),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_user_locations_user ON user_locations(user_id);
CREATE INDEX idx_user_locations_geom ON user_locations USING GIST(geom);
CREATE INDEX idx_user_locations_timestamp ON user_locations(timestamp);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('risk_alert', 'crime_nearby', 'area_update', 'system', 'emergency')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'danger', 'success')),
    related_crime_id UUID REFERENCES crime_incidents(id),
    related_area_id UUID REFERENCES areas(id),
    is_read BOOLEAN DEFAULT false,
    is_sent BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_created ON notifications(created_at);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);

-- ============================================
-- SAFE ROUTES TABLE
-- ============================================
CREATE TABLE safe_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    name VARCHAR(255),
    start_lat DECIMAL(10, 8) NOT NULL,
    start_lng DECIMAL(11, 8) NOT NULL,
    end_lat DECIMAL(10, 8) NOT NULL,
    end_lng DECIMAL(11, 8) NOT NULL,
    waypoints JSONB, -- Array of {lat, lng} points
    route_geom GEOGRAPHY(LINESTRING, 4326),
    distance_km DECIMAL(10, 2),
    estimated_time_minutes INTEGER,
    risk_score DECIMAL(5, 2), -- 0-100
    is_saved BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP
);

CREATE INDEX idx_safe_routes_user ON safe_routes(user_id);
CREATE INDEX idx_safe_routes_geom ON safe_routes USING GIST(route_geom);

-- ============================================
-- EMERGENCY SOS TABLE
-- ============================================
CREATE TABLE emergency_sos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    geom GEOGRAPHY(POINT, 4326),
    emergency_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'responded', 'cancelled', 'resolved')),
    message TEXT,
    responded_by UUID REFERENCES users(id),
    response_time INTERVAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

CREATE INDEX idx_emergency_sos_user ON emergency_sos(user_id);
CREATE INDEX idx_emergency_sos_status ON emergency_sos(status);
CREATE INDEX idx_emergency_sos_geom ON emergency_sos USING GIST(geom);

-- ============================================
-- CRIME ANALYTICS (Aggregated data)
-- ============================================
CREATE TABLE crime_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    area_id UUID REFERENCES areas(id),
    crime_type_id VARCHAR(50) REFERENCES crime_types(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_incidents INTEGER DEFAULT 0,
    avg_severity DECIMAL(3, 2),
    risk_score DECIMAL(5, 2),
    trend VARCHAR(20) CHECK (trend IN ('increasing', 'decreasing', 'stable')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_crime_analytics_area ON crime_analytics(area_id);
CREATE INDEX idx_crime_analytics_period ON crime_analytics(period_start, period_end);

-- ============================================
-- USER ACTIVITY LOGS
-- ============================================
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crime_types_updated_at BEFORE UPDATE ON crime_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_areas_updated_at BEFORE UPDATE ON areas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crime_incidents_updated_at BEFORE UPDATE ON crime_incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TRIGGER FOR GEOM COLUMNS (Auto-populate from lat/lng)
-- ============================================
CREATE OR REPLACE FUNCTION update_geom_from_lat_lng()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_areas_geom BEFORE INSERT OR UPDATE ON areas
    FOR EACH ROW EXECUTE FUNCTION update_geom_from_lat_lng();

CREATE TRIGGER update_crime_incidents_geom BEFORE INSERT OR UPDATE ON crime_incidents
    FOR EACH ROW EXECUTE FUNCTION update_geom_from_lat_lng();

CREATE TRIGGER update_user_locations_geom BEFORE INSERT OR UPDATE ON user_locations
    FOR EACH ROW EXECUTE FUNCTION update_geom_from_lat_lng();

CREATE TRIGGER update_emergency_sos_geom BEFORE INSERT OR UPDATE ON emergency_sos
    FOR EACH ROW EXECUTE FUNCTION update_geom_from_lat_lng();

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Crime Statistics by Area
CREATE OR REPLACE VIEW v_area_crime_stats AS
SELECT 
    a.id as area_id,
    a.name_en,
    a.name_bn,
    a.district,
    COUNT(ci.id) as total_crimes,
    AVG(ci.severity) as avg_severity,
    COUNT(CASE WHEN ci.incident_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as crimes_last_30_days,
    COUNT(CASE WHEN ci.incident_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as crimes_last_7_days
FROM areas a
LEFT JOIN crime_incidents ci ON a.id = ci.area_id AND ci.is_verified = true
GROUP BY a.id, a.name_en, a.name_bn, a.district;

-- View: Active High-Risk Areas
CREATE OR REPLACE VIEW v_high_risk_areas AS
SELECT 
    a.*,
    COUNT(ci.id) as recent_crimes,
    AVG(ci.severity) as avg_severity
FROM areas a
LEFT JOIN crime_incidents ci ON a.id = ci.area_id 
    AND ci.incident_date >= CURRENT_DATE - INTERVAL '30 days'
    AND ci.is_verified = true
GROUP BY a.id
HAVING COUNT(ci.id) >= 5 OR AVG(ci.severity) >= 3.5
ORDER BY recent_crimes DESC, avg_severity DESC;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function: Calculate distance between two points
CREATE OR REPLACE FUNCTION calculate_distance(
    lat1 DECIMAL, lng1 DECIMAL, 
    lat2 DECIMAL, lng2 DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
    RETURN ST_Distance(
        ST_SetSRID(ST_MakePoint(lng1, lat1), 4326)::geography,
        ST_SetSRID(ST_MakePoint(lng2, lat2), 4326)::geography
    ) / 1000; -- Convert to kilometers
END;
$$ LANGUAGE plpgsql;

-- Function: Get crimes within radius
CREATE OR REPLACE FUNCTION get_crimes_within_radius(
    center_lat DECIMAL, 
    center_lng DECIMAL, 
    radius_km DECIMAL
)
RETURNS TABLE (
    id UUID,
    crime_type_id VARCHAR,
    latitude DECIMAL,
    longitude DECIMAL,
    severity INTEGER,
    incident_date TIMESTAMP,
    distance_km DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ci.id,
        ci.crime_type_id,
        ci.latitude,
        ci.longitude,
        ci.severity,
        ci.incident_date,
        (ST_Distance(
            ci.geom,
            ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
        ) / 1000)::DECIMAL as distance_km
    FROM crime_incidents ci
    WHERE ST_DWithin(
        ci.geom,
        ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
        radius_km * 1000
    )
    AND ci.is_verified = true
    AND ci.is_public = true
    ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate area risk score
CREATE OR REPLACE FUNCTION calculate_area_risk_score(p_area_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    v_score DECIMAL;
BEGIN
    SELECT 
        LEAST(100, (
            COUNT(ci.id)::DECIMAL * 2 + 
            AVG(ci.severity)::DECIMAL * 10 +
            COUNT(CASE WHEN ci.incident_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END)::DECIMAL * 5
        ))
    INTO v_score
    FROM crime_incidents ci
    WHERE ci.area_id = p_area_id
        AND ci.incident_date >= CURRENT_DATE - INTERVAL '90 days'
        AND ci.is_verified = true;
    
    RETURN COALESCE(v_score, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INITIAL DATA INSERTS
-- ============================================

-- Insert Crime Types
INSERT INTO crime_types (id, name_en, name_bn, color, severity_base) VALUES
('theft', 'Theft', 'চুরি', '#f59e0b', 3),
('robbery', 'Robbery', 'ডাকাতি', '#ef4444', 4),
('assault', 'Assault', 'হামলা', '#dc2626', 4),
('burglary', 'Burglary', 'সিঁধ', '#f97316', 3),
('vandalism', 'Vandalism', 'ভাঙচুর', '#eab308', 2),
('fraud', 'Fraud', 'জালিয়াতি', '#8b5cf6', 3),
('kidnapping', 'Kidnapping', 'অপহরণ', '#991b1b', 5),
('murder', 'Murder', 'হত্যা', '#7f1d1d', 5),
('drug', 'Drug Offense', 'মাদক অপরাধ', '#6366f1', 3),
('traffic', 'Traffic Crime', 'ট্রাফিক অপরাধ', '#14b8a6', 2);

-- Insert Dhaka Areas
INSERT INTO areas (name_en, name_bn, district, division, latitude, longitude, police_station) VALUES
('Gulshan', 'গুলশান', 'Dhaka', 'Dhaka', 23.7808, 90.4177, 'Gulshan Police Station'),
('Dhanmondi', 'ধানমন্ডি', 'Dhaka', 'Dhaka', 23.7465, 90.3765, 'Dhanmondi Police Station'),
('Banani', 'বনানী', 'Dhaka', 'Dhaka', 23.7937, 90.4066, 'Banani Police Station'),
('Mirpur', 'মিরপুর', 'Dhaka', 'Dhaka', 23.8223, 90.3654, 'Mirpur Model Police Station'),
('Uttara', 'উত্তরা', 'Dhaka', 'Dhaka', 23.8759, 90.3795, 'Uttara Police Station'),
('Mohammadpur', 'মোহাম্মদপুর', 'Dhaka', 'Dhaka', 23.7679, 90.3535, 'Mohammadpur Police Station'),
('Motijheel', 'মতিঝিল', 'Dhaka', 'Dhaka', 23.7334, 90.4176, 'Motijheel Police Station'),
('Farmgate', 'ফার্মগেট', 'Dhaka', 'Dhaka', 23.7577, 90.3897, 'Tejgaon Police Station'),
('Badda', 'বাড্ডা', 'Dhaka', 'Dhaka', 23.7808, 90.4265, 'Badda Police Station'),
('Jatrabari', 'যাত্রাবাড়ী', 'Dhaka', 'Dhaka', 23.7100, 90.4327, 'Jatrabari Police Station');

-- Create default admin user (password: admin123)
-- Hash generated using bcrypt with 10 rounds
INSERT INTO users (email, password_hash, full_name, role, email_verified) VALUES
('admin@riskradar.bd', '$2b$10$rKzqjK0vqHqEFnJxBZ5xr.eMZX8kxNqYLGv5JqPYJQKqYGKqZ5LPu', 'System Administrator', 'admin', true),
('police@riskradar.bd', '$2b$10$rKzqjK0vqHqEFnJxBZ5xr.eMZX8kxNqYLGv5JqPYJQKqYGKqZ5LPu', 'Police Officer', 'police', true);

-- ============================================
-- GRANT PERMISSIONS (Adjust based on your setup)
-- ============================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO your_app_user;
