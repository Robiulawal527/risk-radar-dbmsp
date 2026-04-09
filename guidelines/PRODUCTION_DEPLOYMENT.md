# 🚀 Risk Radar - Complete Production Deployment Guide

## 📋 Table of Contents
1. [System Architecture](#system-architecture)
2. [Prerequisites](#prerequisites)
3. [Quick Start with Docker](#quick-start-with-docker)
4. [Manual Deployment](#manual-deployment)
5. [Environment Configuration](#environment-configuration)
6. [Database Setup](#database-setup)
7. [Backend Deployment](#backend-deployment)
8. [Frontend Deployment](#frontend-deployment)
9. [Security Hardening](#security-hardening)
10. [Monitoring & Maintenance](#monitoring--maintenance)
11. [Troubleshooting](#troubleshooting)

---

## 🏗️ System Architecture

```
┌─────────────────┐
│   Frontend      │ React + Tailwind + Leaflet
│   (Port 3000)   │ Real-time WebSocket client
└────────┬────────┘
         │
    HTTP/WS
         │
┌────────▼────────┐
│   Backend API   │ Node.js + Express + Socket.IO
│   (Port 5000)   │ JWT Authentication
└────────┬────────┘
         │
         │
┌────────▼────────┐
│   PostgreSQL    │ PostGIS enabled
│   + PostGIS     │ Geospatial queries
│   (Port 5432)   │
└─────────────────┘
```

---

## ✅ Prerequisites

### Required Software
- **Node.js** 18+ and npm 9+
- **PostgreSQL** 14+ with PostGIS 3.3+
- **Docker** 20+ and Docker Compose 2+ (for containerized deployment)
- **Git** for version control
- **Nginx** (for production reverse proxy)

### System Requirements
- **Minimum**: 2 CPU cores, 4GB RAM, 20GB storage
- **Recommended**: 4 CPU cores, 8GB RAM, 50GB SSD storage
- **OS**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+ / macOS / Windows with WSL2

---

## 🐳 Quick Start with Docker (Recommended)

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd risk-radar
```

### 2. Configure Environment
```bash
# Copy environment template
cp server/.env.example server/.env

# Edit with your settings
nano server/.env
```

**Required changes in `.env`:**
```env
DB_PASSWORD=YourSecurePasswordHere123!
JWT_SECRET=YourSuperSecretJWTKeyMinimum32CharactersLong!
FRONTEND_URL=http://your-domain.com
```

### 3. Start All Services
```bash
# Build and start containers
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 4. Initialize Database
```bash
# Database is auto-initialized with schema.sql
# Verify it's working:
docker-compose exec postgres psql -U riskradar_user -d riskradar_db -c "SELECT COUNT(*) FROM crime_types;"
```

### 5. Access Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Health**: http://localhost:5000/health
- **Database**: localhost:5432

### 6. Login with Default Credentials
```
Admin Account:
Email: admin@riskradar.bd
Password: admin123

⚠️ CHANGE IMMEDIATELY AFTER FIRST LOGIN!
```

---

## 🔧 Manual Deployment

### Step 1: Database Setup

#### Install PostgreSQL with PostGIS
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql-14 postgresql-14-postgis-3

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Create Database
```bash
sudo -u postgres psql
```

```sql
-- Create database and user
CREATE DATABASE riskradar_db;
CREATE USER riskradar_user WITH ENCRYPTED PASSWORD 'YourSecurePassword123!';
GRANT ALL PRIVILEGES ON DATABASE riskradar_db TO riskradar_user;

-- Enable PostGIS
\c riskradar_db
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\q
```

#### Load Schema
```bash
psql -U riskradar_user -d riskradar_db -f database/schema.sql
```

#### Verify Installation
```bash
psql -U riskradar_user -d riskradar_db
```

```sql
-- Check tables
\dt

-- Check PostGIS
SELECT PostGIS_version();

-- Check sample data
SELECT * FROM crime_types;
SELECT * FROM areas;
SELECT * FROM users;

\q
```

---

### Step 2: Backend Deployment

#### Install Dependencies
```bash
cd server
npm install --production
```

#### Configure Environment
```bash
cp .env.example .env
nano .env
```

Update with production values:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=riskradar_db
DB_USER=riskradar_user
DB_PASSWORD=YourActualPassword

PORT=5000
NODE_ENV=production

JWT_SECRET=Generate-A-Secure-Random-32-Plus-Character-Secret-Key
JWT_EXPIRE=7d

FRONTEND_URL=https://your-domain.com

BCRYPT_ROUNDS=12
```

#### Start Backend with PM2
```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start src/server.js --name riskradar-api

# Save PM2 configuration
pm2 save

# Enable PM2 on system startup
pm2 startup
# Follow the instructions printed

# Monitor
pm2 status
pm2 logs riskradar-api
pm2 monit
```

#### Verify Backend
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2025-04-09T...",
  "uptime": 123.456,
  "environment": "production"
}
```

---

### Step 3: Frontend Deployment

#### Build Frontend
```bash
# From project root
npm install
npm run build
```

This creates optimized files in `dist/` directory.

#### Option A: Serve with Nginx

Install Nginx:
```bash
sudo apt install nginx
```

Create Nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/riskradar
```

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    root /var/www/riskradar/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Cache static assets
    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # React Router support
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/riskradar /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Option B: Deploy to Vercel/Netlify
```bash
# Vercel
npm install -g vercel
vercel --prod

# Netlify
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

---

### Step 4: Reverse Proxy for Backend

Add API proxy to Nginx configuration:
```nginx
# Add to existing Nginx config
upstream backend {
    server localhost:5000;
}

server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## 🔐 SSL/TLS Setup with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificates
sudo certbot --nginx -d your-domain.com -d www.your-domain.com -d api.your-domain.com

# Auto-renewal is configured automatically
# Test renewal:
sudo certbot renew --dry-run
```

---

## 🔒 Security Hardening

### 1. Firewall Configuration
```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 2. PostgreSQL Security
```bash
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

```conf
# Allow only local connections
local   all             all                                     peer
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
```

```bash
sudo systemctl restart postgresql
```

### 3. Environment Variables
- Never commit `.env` files to Git
- Use strong, random passwords (32+ characters)
- Rotate JWT secrets periodically
- Use different secrets for dev/staging/production

### 4. Rate Limiting (already implemented in backend)
- API calls limited to 100 requests per 15 minutes per IP
- Adjust in backend `.env` if needed

### 5. Regular Updates
```bash
# System updates
sudo apt update && sudo apt upgrade

# Node.js dependencies
npm audit
npm audit fix

# Database
sudo apt upgrade postgresql-14
```

---

## 📊 Monitoring & Maintenance

### Application Monitoring with PM2
```bash
pm2 monit                    # Real-time monitoring
pm2 logs riskradar-api      # View logs
pm2 restart riskradar-api   # Restart application
pm2 reload riskradar-api    # Zero-downtime reload
```

### Database Maintenance

#### Weekly Backup Script
Create `/etc/cron.weekly/backup-riskradar`:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/riskradar"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U riskradar_user riskradar_db | gzip > $BACKUP_DIR/riskradar_${DATE}.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: riskradar_${DATE}.sql.gz"
```

Make executable:
```bash
sudo chmod +x /etc/cron.weekly/backup-riskradar
```

#### Database Optimization (run monthly)
```sql
-- Connect to database
psql -U riskradar_user -d riskradar_db

-- Vacuum and analyze
VACUUM ANALYZE;

-- Reindex
REINDEX DATABASE riskradar_db;

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Log Monitoring
```bash
# Backend logs
tail -f server/logs/combined.log
tail -f server/logs/error.log

# PM2 logs
pm2 logs --lines 100

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

---

## 🐛 Troubleshooting

### Backend Won't Start
```bash
# Check logs
pm2 logs riskradar-api

# Common issues:
# 1. Database connection failed
psql -U riskradar_user -d riskradar_db -c "SELECT 1;"

# 2. Port already in use
sudo lsof -i :5000
# Kill process if needed

# 3. Missing environment variables
cat server/.env
```

### Database Connection Issues
```bash
# Test connection
psql -U riskradar_user -d riskradar_db

# Check PostgreSQL status
sudo systemctl status postgresql

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Frontend Not Loading
```bash
# Check Nginx status
sudo systemctl status nginx

# Test Nginx configuration
sudo nginx -t

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Rebuild frontend
npm run build
```

### WebSocket Connection Failed
- Check if port 5000 is accessible
- Verify CORS settings in backend `.env`
- Check browser console for errors
- Ensure WebSocket protocol matches (ws:// vs wss://)

---

## 📈 Scaling Recommendations

### Database
1. **Read Replicas**: Set up PostgreSQL streaming replication
2. **Connection Pooling**: Use PgBouncer
3. **Partitioning**: Partition crime_incidents table by date
4. **Indexing**: Monitor slow queries and add indexes

### Backend
1. **Horizontal Scaling**: Run multiple Node.js instances with load balancer
2. **Caching**: Add Redis for session management and API caching
3. **CDN**: Use CloudFlare or AWS CloudFront for static assets
4. **Message Queue**: Use RabbitMQ/Redis for async tasks

### Monitoring
1. **APM**: New Relic, DataDog, or PM2 Plus
2. **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)
3. **Uptime**: UptimeRobot, Pingdom
4. **Alerts**: Set up email/SMS alerts for errors

---

## 🎯 Production Checklist

Before going live:

- [ ] Changed all default passwords
- [ ] Generated strong JWT secrets
- [ ] Configured SSL/TLS certificates
- [ ] Set up firewall rules
- [ ] Configured database backups
- [ ] Enabled monitoring and logging
- [ ] Tested all API endpoints
- [ ] Verified WebSocket connections
- [ ] Tested emergency SOS system
- [ ] Reviewed security headers
- [ ] Set up error tracking
- [ ] Configured rate limiting
- [ ] Tested on mobile devices
- [ ] Created admin documentation
- [ ] Set up uptime monitoring

---

## 📞 Support & Maintenance

### Regular Tasks
- **Daily**: Check application logs for errors
- **Weekly**: Review database backups
- **Monthly**: Update dependencies, vacuum database
- **Quarterly**: Security audit, performance review

### Emergency Contacts
- Database issues: Check PostgreSQL documentation
- Backend issues: Review Node.js error logs
- Frontend issues: Check browser console
- Security issues: Immediately rotate secrets, check access logs

---

## 🎉 Success!

Your Risk Radar application is now deployed and ready for production use!

Access your application at: https://your-domain.com
Admin panel: https://your-domain.com/admin
API documentation: https://api.your-domain.com/health

**Remember to change default admin password immediately after first login!**
