# Risk Radar - Production Deployment Guide

## Database Setup

### PostgreSQL Requirements
- PostgreSQL 14+ with PostGIS extension
- Minimum 2GB RAM, 20GB storage
- Connection pooling enabled

### Initial Setup

1. **Install PostgreSQL and PostGIS**
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install postgresql-14 postgresql-14-postgis-3

# Enable PostGIS extension
sudo -u postgres psql -c "CREATE EXTENSION postgis;"
```

2. **Create Database**
```bash
sudo -u postgres psql
CREATE DATABASE riskradar_db;
CREATE USER riskradar_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE riskradar_db TO riskradar_user;
\q
```

3. **Run Schema**
```bash
psql -U riskradar_user -d riskradar_db -f database/schema.sql
```

4. **Verify Installation**
```sql
-- Check tables
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check PostGIS
SELECT PostGIS_version();

-- Verify crime types
SELECT * FROM crime_types;
```

## Backend Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
cd server
npm install
```

### Environment Configuration
Create `.env` file in `/server`:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=riskradar_db
DB_USER=riskradar_user
DB_PASSWORD=your_secure_password
DB_SSL=false

# Server
PORT=5000
NODE_ENV=production
API_VERSION=v1

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=your_refresh_token_secret
JWT_REFRESH_EXPIRE=30d

# CORS
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Real-time
WEBSOCKET_PORT=5001

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# SMS (optional - for emergency alerts)
SMS_API_KEY=your_sms_api_key
SMS_SENDER_ID=RiskRadar

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_DIR=./uploads

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# Security
BCRYPT_ROUNDS=10
SESSION_SECRET=your_session_secret
HELMET_ENABLED=true

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
```

### Start Backend
```bash
# Development
npm run dev

# Production
npm start

# With PM2 (recommended for production)
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Frontend Setup

### Update API Configuration
The frontend is already configured to connect to the backend. Just set the API URL:

Create `.env` in root directory:
```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_WS_URL=ws://localhost:5001
```

### Build for Production
```bash
npm run build
```

## Production Deployment

### Using Docker (Recommended)

1. **Build Containers**
```bash
docker-compose up -d
```

2. **Check Status**
```bash
docker-compose ps
docker-compose logs -f
```

### Manual Deployment

1. **Database Server** (PostgreSQL)
   - Set up on dedicated server or managed service (AWS RDS, DigitalOcean, etc.)
   - Configure SSL connections
   - Set up automated backups
   - Enable connection pooling

2. **Backend Server** (Node.js)
   - Deploy on VPS, AWS EC2, Heroku, or similar
   - Use PM2 or similar process manager
   - Set up reverse proxy with Nginx
   - Configure SSL certificates

3. **Frontend** (React)
   - Build static files: `npm run build`
   - Deploy to CDN (Cloudflare, AWS S3 + CloudFront, Netlify, Vercel)
   - Configure domain and SSL

### Nginx Configuration
```nginx
# Backend API
server {
    listen 80;
    server_name api.riskradar.bd;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}

# Frontend
server {
    listen 80;
    server_name riskradar.bd www.riskradar.bd;
    root /var/www/riskradar/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Database Maintenance

### Backup Strategy
```bash
# Daily backups
0 2 * * * pg_dump -U riskradar_user riskradar_db | gzip > /backups/riskradar_$(date +\%Y\%m\%d).sql.gz

# Weekly full backup
0 3 * * 0 pg_dump -U riskradar_user -F c riskradar_db > /backups/weekly/riskradar_$(date +\%Y\%m\%d).dump
```

### Optimization
```sql
-- Vacuum and analyze (run weekly)
VACUUM ANALYZE;

-- Reindex (run monthly)
REINDEX DATABASE riskradar_db;

-- Update statistics
ANALYZE;
```

### Monitoring Queries
```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('riskradar_db'));

-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Slow queries
SELECT pid, now() - query_start as duration, query 
FROM pg_stat_activity 
WHERE state = 'active' AND now() - query_start > interval '5 seconds';

-- Table sizes
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Scaling Recommendations

### Database
- Use read replicas for read-heavy operations
- Implement connection pooling (PgBouncer)
- Partition large tables by date
- Use materialized views for analytics

### Backend
- Horizontal scaling with load balancer
- Redis for session management and caching
- Message queue (RabbitMQ/Redis) for async tasks
- CDN for static assets

### Monitoring
- Set up logging aggregation (ELK stack)
- Application monitoring (New Relic, DataDog)
- Uptime monitoring
- Performance metrics

## Security Checklist

- [ ] Change default passwords
- [ ] Enable SSL/TLS for all connections
- [ ] Set up firewall rules
- [ ] Implement rate limiting
- [ ] Enable CORS properly
- [ ] Regular security updates
- [ ] Backup encryption
- [ ] API authentication tokens rotation
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS protection
- [ ] CSRF tokens
- [ ] Input validation and sanitization

## Default Credentials

**Admin Account:**
- Email: admin@riskradar.bd
- Password: admin123
- **IMPORTANT:** Change this immediately after first login!

**Police Account:**
- Email: police@riskradar.bd
- Password: admin123
- **IMPORTANT:** Change this immediately!
