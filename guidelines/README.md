# 🚨 Risk Radar - Crime Tracking & Safety Platform

<div align="center">

![Risk Radar](https://img.shields.io/badge/Risk%20Radar-Crime%20Safety-red?style=for-the-badge)
![Version](https://img.shields.io/badge/version-1.0.0-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/status-production%20ready-success?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)

**A comprehensive crime tracking and public safety platform for Bangladesh**

[Features](#features) • [Demo](#demo) • [Quick Start](#-quick-start) • [Documentation](#documentation) • [Deployment](#-deployment)

</div>

---

## 📖 Overview

Risk Radar is a **100% production-ready** full-stack web application designed to help citizens, police, and administrators track crime incidents, analyze trends, and promote public safety. Built with modern technologies and real-time capabilities, it provides an intuitive interface for crime reporting, heatmap visualization, safe route planning, and emergency response.

### ✅ Production Status

This application is **fully tested and production-ready** with:
- ✅ Error boundaries and comprehensive error handling
- ✅ Protected routes with role-based authorization
- ✅ Environment-based configuration
- ✅ Optimized build with code splitting
- ✅ Security best practices implemented
- ✅ Client-side logging and monitoring
- ✅ Health check system
- ✅ Complete documentation

### 🎯 Key Highlights

- ✅ **Real-time Crime Tracking** with interactive heatmaps
- ✅ **AI-Powered Risk Prediction** for crime hotspots
- ✅ **Live Location Monitoring** with automatic risk alerts
- ✅ **Emergency SOS System** with instant police notification
- ✅ **Safe Route Finder** to avoid high-risk areas
- ✅ **Multi-language Support** (English + Bangla)
- ✅ **Role-Based Access Control** (User, Police, Admin)
- ✅ **Comprehensive Analytics Dashboard**
- ✅ **Mobile-Responsive Design**
- ✅ **Production-Ready** with optimized deployment

---

## 🚀 Features

### For Citizens
- 📍 **Crime Map Visualization**: Interactive Leaflet maps with crime incidents
- 🔥 **Heatmap View**: Identify high-crime density areas
- 🚨 **Emergency SOS Button**: One-tap emergency alert with location
- 🛣️ **Safe Route Planner**: Calculate safest paths between locations
- 📊 **Crime Analytics**: View trends, statistics, and predictions
- 🔔 **Real-time Alerts**: Get notified when entering high-risk zones
- 🌐 **Bilingual Interface**: Switch between English and Bangla
- 📱 **Mobile Optimized**: Works seamlessly on all devices

### For Police/Admin
- 🎛️ **Admin Dashboard**: Manage all crime reports
- ✏️ **CRUD Operations**: Create, Read, Update, Delete crime incidents
- ✅ **Verification System**: Verify and validate user-reported crimes
- 👥 **User Management**: Control user accounts and permissions
- 🚑 **Emergency Response**: Monitor and respond to SOS alerts
- 📈 **Advanced Analytics**: Deep insights into crime patterns
- 🗺️ **Area Risk Assessment**: Calculate and monitor area safety scores

### Technical Features
- 🔐 **JWT Authentication**: Secure token-based auth system
- 🔌 **WebSocket Integration**: Real-time bidirectional communication
- 🗄️ **PostgreSQL + PostGIS**: Powerful geospatial database
- 📡 **RESTful API**: Well-documented backend API
- 🐳 **Docker Support**: Easy containerized deployment
- 🔄 **Auto-sync**: Real-time data synchronization
- 🛡️ **Security Hardened**: Rate limiting, CORS, helmet.js
- 📝 **Activity Logging**: Complete audit trail

---

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS v4** - Styling framework
- **Leaflet** - Interactive maps
- **Leaflet.heat** - Heatmap visualization
- **Recharts** - Data visualization
- **React Router v7** - Client-side routing
- **Socket.IO Client** - WebSocket communication
- **Lucide React** - Icon library
- **Radix UI** - Accessible components

### Backend
- **Node.js 18+** - Runtime environment
- **Express.js** - Web framework
- **PostgreSQL 14+** - Primary database
- **PostGIS** - Geospatial extension
- **Socket.IO** - WebSocket server
- **JWT** - Authentication
- **Bcrypt** - Password hashing
- **Winston** - Logging
- **Helmet** - Security headers
- **Express Rate Limit** - API rate limiting

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **PM2** - Process management
- **Nginx** - Reverse proxy & web server
- **Let's Encrypt** - SSL/TLS certificates

---

## 📦 Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ with PostGIS
- Docker & Docker Compose (optional)

### Quick Start (Docker - Recommended)

```bash
# 1. Clone repository
git clone https://github.com/yourusername/risk-radar.git
cd risk-radar

# 2. Configure environment
cp server/.env.example server/.env
# Edit server/.env with your settings

# 3. Start all services
docker-compose up -d

# 4. Access application
# Frontend: http://localhost:3000
# Backend: http://localhost:5000
# Database: localhost:5432
```

### Manual Installation

See [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) for detailed instructions.

---

## 🎮 Demo

### Default Credentials

**Admin Account:**
```
Email: admin@riskradar.bd
Password: admin123
```

**Police Account:**
```
Email: police@riskradar.bd
Password: admin123
```

⚠️ **IMPORTANT**: Change these passwords immediately after first login!

### Sample Data

The database is pre-populated with:
- 10 crime types
- 10 Dhaka areas
- Sample admin and police accounts
- Real-time notification system ready

---

## 📚 Documentation

### Database Schema

See [database/schema.sql](./database/schema.sql) for complete schema with:
- **11 main tables** with proper relationships
- **PostGIS geospatial columns** for location queries
- **Indexes** for optimized performance
- **Triggers** for auto-updates
- **Views** for common queries
- **Functions** for complex calculations

### API Documentation

#### Authentication
```http
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
PUT  /api/v1/auth/profile
PUT  /api/v1/auth/password
```

#### Crimes
```http
GET    /api/v1/crimes?type=&area=&severity=&startDate=&endDate=
GET    /api/v1/crimes/:id
POST   /api/v1/crimes
PUT    /api/v1/crimes/:id        # Admin/Police only
DELETE /api/v1/crimes/:id        # Admin only
GET    /api/v1/crimes/types
GET    /api/v1/crimes/nearby?lat=&lng=&radius=
```

#### Analytics
```http
GET /api/v1/analytics/stats
GET /api/v1/analytics/areas
GET /api/v1/analytics/predictions
```

#### Emergency
```http
POST /api/v1/emergency/sos
GET  /api/v1/emergency/sos/active    # Police/Admin only
PUT  /api/v1/emergency/sos/:id       # Police/Admin only
```

#### Safe Routes
```http
POST /api/v1/routes/calculate
GET  /api/v1/routes/saved
```

### WebSocket Events

#### Client → Server
```javascript
// Location updates
socket.emit('location:update', { latitude, longitude, accuracy });

// Emergency SOS
socket.emit('emergency:sos', { latitude, longitude, emergencyType, message });

// Crime report
socket.emit('crime:report', crimeData);
```

#### Server → Client
```javascript
// Risk alerts
socket.on('risk:alert', (data) => {
  // Handle high-risk zone alert
});

// Nearby crimes
socket.on('crime:nearby', (data) => {
  // Handle nearby crime notification
});

// Emergency notifications
socket.on('emergency:new', (data) => {
  // Handle new SOS alert
});

// General notifications
socket.on('notification', (data) => {
  // Handle any notification
});
```

---

## 🔧 Configuration

### Environment Variables

#### Backend (`server/.env`)
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=riskradar_db
DB_USER=riskradar_user
DB_PASSWORD=your_secure_password

# Server
PORT=5000
NODE_ENV=production

# JWT
JWT_SECRET=your_super_secret_jwt_key_32_chars_minimum
JWT_EXPIRE=7d

# Security
BCRYPT_ROUNDS=12
FRONTEND_URL=https://your-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Frontend (`.env`)
```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_WS_URL=ws://localhost:5000
```

---

## 📊 Database Design

### Core Tables

1. **users** - User accounts with authentication
2. **crime_types** - Predefined crime categories
3. **areas** - Geographic areas with coordinates
4. **crime_incidents** - Main crime report table
5. **user_locations** - Real-time user location tracking
6. **notifications** - User notification system
7. **safe_routes** - Safe route calculations
8. **emergency_sos** - Emergency alert system
9. **crime_analytics** - Aggregated analytics data
10. **activity_logs** - Complete audit trail

### Geospatial Features
- **PostGIS GEOGRAPHY columns** for accurate distance calculations
- **Spatial indexes (GIST)** for fast location queries
- **Built-in functions** for distance, radius, and route calculations
- **Automatic geometry updates** via triggers

---

## 🔐 Security Features

1. **Authentication & Authorization**
   - JWT token-based authentication
   - Role-based access control (RBAC)
   - Secure password hashing with bcrypt
   - Token expiration and refresh

2. **API Security**
   - Rate limiting (100 req/15min per IP)
   - CORS protection
   - Helmet.js security headers
   - Input validation and sanitization
   - SQL injection prevention (parameterized queries)

3. **Data Protection**
   - Encrypted passwords
   - Secure WebSocket connections
   - HTTPS/WSS in production
   - Database backup encryption

4. **Monitoring**
   - Activity logging
   - Error tracking
   - Access logs
   - Suspicious activity detection

---

## 🚦 Deployment

### Production Deployment

See [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) for comprehensive deployment guide including:
- Docker deployment
- Manual deployment steps
- SSL/TLS configuration
- Nginx setup
- Database optimization
- Monitoring setup
- Security hardening
- Backup strategies

### Deployment Checklist
- [ ] Update all environment variables
- [ ] Change default passwords
- [ ] Configure SSL certificates
- [ ] Set up database backups
- [ ] Enable monitoring
- [ ] Configure firewall
- [ ] Test all features
- [ ] Set up error tracking
- [ ] Configure CDN (optional)
- [ ] Enable auto-scaling (optional)

---

## 🧪 Testing

```bash
# Backend tests
cd server
npm test

# Frontend tests
npm test

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

---

## 📱 Mobile Support

Risk Radar is fully responsive and optimized for:
- 📱 iOS Safari
- 📱 Android Chrome
- 💻 Desktop browsers (Chrome, Firefox, Safari, Edge)
- 🖥️ Tablet devices

### PWA Support (Coming Soon)
- Install as native app
- Offline functionality
- Push notifications
- Background sync

---

## 🌍 Multi-language Support

Currently supported languages:
- 🇬🇧 English
- 🇧🇩 বাংলা (Bangla)

Easy to add more languages by extending `LanguageContext.tsx`.

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style
- Write meaningful commit messages
- Add tests for new features
- Update documentation
- Ensure all tests pass

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Team

- **Development Team** - Full-stack development
- **Database Design** - PostgreSQL + PostGIS architecture
- **UI/UX Design** - User interface and experience

---

## 🙏 Acknowledgments

- OpenStreetMap for map tiles
- Leaflet for mapping library
- React community for excellent tools
- Bangladesh Police for inspiration

---

## 📞 Support

For support, email support@riskradar.bd or open an issue on GitHub.

---

## 🗺️ Roadmap

### Version 1.1 (Coming Soon)
- [ ] Mobile app (React Native)
- [ ] Push notifications
- [ ] Advanced AI predictions
- [ ] Crime pattern analysis
- [ ] Community forums
- [ ] Incident photos upload
- [ ] Crowdsourced safety ratings

### Version 2.0 (Future)
- [ ] Machine learning crime prediction
- [ ] Integration with police systems
- [ ] SMS alert system
- [ ] Multi-city support
- [ ] Advanced reporting tools
- [ ] Data export features
- [ ] Public API for researchers

---

<div align="center">

**Built with ❤️ for public safety in Bangladesh**

[Report Bug](https://github.com/yourusername/risk-radar/issues) • [Request Feature](https://github.com/yourusername/risk-radar/issues) • [Documentation](./PRODUCTION_DEPLOYMENT.md)

</div>