# 🚨 Risk Radar - Crime Tracking & Public Safety Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.2.0-blue.svg)](https://reactjs.org/)
[![React Native](https://img.shields.io/badge/React%20Native-0.73.2-blue.svg)](https://reactnative.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14-blue.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

**Risk Radar** is a comprehensive public safety and crime tracking platform designed to enhance community safety through real-time crime reporting, emergency alerts, and intelligent route planning. The platform provides both web and mobile applications with a robust backend API.

## 🌟 Key Features

### 📱 Mobile App Features
- **Real-time Crime Reporting** with photo/video evidence
- **Interactive Maps** with crime hotspots and safe routes
- **Emergency SOS** with location sharing
- **Push Notifications** for safety alerts
- **Offline Capability** for critical features
- **Multi-language Support** (i18n ready)
- **Biometric Authentication** and secure login
- **Background Location Tracking** for safety monitoring

### 🌐 Web Dashboard Features
- **Admin Dashboard** for crime management
- **Interactive Analytics** with charts and reports
- **User Management** system
- **Crime Statistics** and trend analysis
- **Emergency Contact Management**
- **Real-time Notifications** center
- **Responsive Design** for all devices

### 🖥️ Backend Features
- **RESTful API** with comprehensive endpoints
- **Real-time WebSocket** communication
- **JWT Authentication** with role-based access
- **Geospatial Queries** with PostGIS
- **File Upload** handling for evidence
- **Rate Limiting** and security middleware
- **Comprehensive Logging** with Winston
- **Database Migrations** and seeding

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   Web Dashboard │    │   Backend API   │
│  (React Native) │    │    (React)      │    │  (Node.js)      │
│                 │    │                 │    │                 │
│ • Expo Go       │    │ • Vite          │    │ • Express       │
│ • React Nav     │    │ • TypeScript    │    │ • PostgreSQL    │
│ • Maps          │    │ • Material-UI   │    │ • WebSocket     │
│ • Push Notif    │    │ • Recharts      │    │ • JWT Auth      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   + PostGIS     │
                    │                 │
                    │ • Geospatial    │
                    │ • UUID support  │
                    │ • JSON fields   │
                    └─────────────────┘
```

## 📁 Project Structure

```
risk-radar/
├── 📱 mobile/                     # React Native Mobile App
│   ├── src/
│   │   ├── components/           # Reusable UI components
│   │   ├── screens/              # App screens/pages
│   │   ├── navigation/           # Navigation configuration
│   │   ├── services/             # API & notification services
│   │   ├── context/              # React Context providers
│   │   ├── types/                # TypeScript definitions
│   │   └── utils/                # Helper utilities
│   ├── app.json                  # Expo configuration
│   └── package.json              # Mobile dependencies
│
├── 🌐 web/                        # React Web Dashboard
│   ├── frontend/src/
│   │   ├── app/                  # Main app components
│   │   ├── components/           # UI components
│   │   ├── styles/               # Styling files
│   │   └── types/                # Type definitions
│   ├── package.json              # Web dependencies
│   ├── vite.config.ts            # Vite configuration
│   └── tsconfig.json             # TypeScript config
│
├── 🖥️ backend/                    # Node.js API Server
│   └── server/
│       ├── src/
│       │   ├── controllers/      # Route handlers
│       │   ├── middleware/       # Auth & validation
│       │   ├── routes/           # API endpoints
│       │   ├── services/         # Business logic
│       │   ├── config/           # App configuration
│       │   └── utils/            # Helper functions
│       ├── Dockerfile            # Container config
│       └── package.json          # Backend dependencies
│
├── 🗄️ database/                   # Database Layer
│   ├── schema.sql                # PostgreSQL schema
│   └── README.md                 # Database docs
│
└── 📚 guidelines/                 # Documentation & Deployment
    ├── docker-compose.yml        # Multi-container setup
    ├── *.md                      # Documentation files
    └── PRODUCTION_DEPLOYMENT.md  # Deployment guide
```

## 🛠️ Tech Stack

### 📱 Mobile Application
```json
{
  "Framework": "React Native 0.73.2 + Expo SDK 55",
  "Language": "TypeScript",
  "Navigation": "React Navigation v6",
  "State Management": "React Context API",
  "UI Libraries": [
    "React Native Paper",
    "React Native Elements",
    "React Native Vector Icons"
  ],
  "Maps": "React Native Maps",
  "Location Services": "Expo Location + Background Geolocation",
  "Storage": "AsyncStorage",
  "Networking": "Axios",
  "Real-time": "Socket.IO Client",
  "Push Notifications": "Firebase + React Native Push Notification",
  "Authentication": "JWT + Biometrics",
  "Image Handling": "React Native Image Picker",
  "Internationalization": "i18next"
}
```

### 🌐 Web Dashboard
```json
{
  "Framework": "React 19.2.0",
  "Build Tool": "Vite 6.3.5",
  "Language": "TypeScript",
  "Styling": [
    "Tailwind CSS",
    "Material-UI (MUI)",
    "Radix UI Components",
    "Emotion (CSS-in-JS)"
  ],
  "State Management": "React Context API",
  "Routing": "React Router",
  "Charts": "Recharts",
  "HTTP Client": "Axios",
  "Date Handling": "date-fns"
}
```

### 🖥️ Backend API
```json
{
  "Runtime": "Node.js",
  "Framework": "Express.js",
  "Language": "JavaScript",
  "Database": "PostgreSQL + PostGIS",
  "Authentication": "JWT + bcrypt",
  "Validation": "express-validator",
  "Security": ["Helmet", "CORS", "Rate Limiting"],
  "Real-time": "Socket.IO",
  "File Upload": "Multer",
  "Logging": "Winston"
}
```

### 🗄️ Database
```sql
{
  "Database": "PostgreSQL 14 + PostGIS",
  "Features": [
    "Geospatial data support",
    "UUID primary keys",
    "JSON data types",
    "Full-text search",
    "Triggers & functions"
  ]
}
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and **npm** 9+
- **PostgreSQL** 14+ with PostGIS (for backend)
- **Android Studio** (for Android development)
- **Xcode** (for iOS development on macOS)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Robiulawal527/risk-radar.git
   cd risk-radar
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp backend/server/.env.example backend/server/.env
   # Edit .env with your database credentials
   ```

4. **Set up the database:**
   ```bash
   # Using Docker Compose (recommended)
   cd guidelines
   docker-compose up -d postgres

   # Or install PostgreSQL locally and run:
   psql -U postgres -f database/schema.sql
   ```

## 🏃‍♂️ Running the Applications

### 🌐 Web Dashboard
```bash
# Development mode
npm run web:dev

# Build for production
npm run web:build

# Preview production build
npm run web:preview

# Type checking
npm run web:type-check
```
**Access:** `http://localhost:3000`

### 📱 Mobile App
```bash
# Start Expo development server
npm run mobile:start

# Or run directly:
cd mobile && npx expo start

# For Android emulator
npm run mobile:android

# For iOS simulator (macOS)
npm run mobile:ios
```
**Scan QR code with Expo Go app**

### 🖥️ Backend API
```bash
npm run backend:start
```
**API:** `http://localhost:5000/api/v1`

## 🐳 Docker Deployment

### Development Environment
```bash
cd guidelines
docker-compose up -d
```

### Production Deployment
```bash
# Build and deploy all services
docker-compose -f docker-compose.prod.yml up -d
```

## 📊 API Documentation

### Authentication Endpoints
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/refresh` - Refresh JWT token

### Crime Management
- `GET /api/v1/crimes` - Get crimes with filters
- `POST /api/v1/crimes` - Report new crime
- `PUT /api/v1/crimes/:id` - Update crime status
- `DELETE /api/v1/crimes/:id` - Delete crime

### User Management
- `GET /api/v1/users/profile` - Get user profile
- `PUT /api/v1/users/profile` - Update profile
- `GET /api/v1/users/emergency-contacts` - Get emergency contacts

### Real-time Features
- **WebSocket**: `ws://localhost:5000`
- **Events**: `crime-reported`, `emergency-alert`, `location-update`

## 🔧 Development Scripts

```bash
# Root level scripts
npm run web:dev          # Start web development server
npm run web:build        # Build web for production
npm run mobile:start     # Start Expo development server
npm run mobile:android   # Run on Android emulator
npm run mobile:ios       # Run on iOS simulator
npm run backend:start    # Start backend API server

# Individual project scripts
cd web && npm run dev
cd mobile && npm run start
cd backend/server && npm run dev
```

## 🧪 Testing

```bash
# Backend tests
cd backend/server && npm test

# Mobile tests
cd mobile && npm test

# Web type checking
cd web && npm run type-check
```

## 🚢 Deployment

### Environment Variables
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=riskradar_db
DB_USER=riskradar_user
DB_PASSWORD=your_secure_password

# JWT
JWT_SECRET=your_jwt_secret_min_32_chars

# App
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://yourdomain.com

# Firebase (for push notifications)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
```

### Production Checklist
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database backups scheduled
- [ ] Monitoring and logging set up
- [ ] Firewall rules configured
- [ ] CDN configured for static assets

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation
- Use conventional commits
- Ensure code passes linting

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **React Native Community** for excellent mobile development tools
- **Expo Team** for the amazing development platform
- **Material-UI** for beautiful React components
- **PostGIS** for geospatial capabilities
- **Open Source Community** for invaluable tools and libraries

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/Robiulawal527/risk-radar/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Robiulawal527/risk-radar/discussions)
- **Documentation**: See `guidelines/` folder for detailed guides

---

**Made with ❤️ for safer communities worldwide**

## Notes

- `web/` and `mobile/` are now separated into distinct apps.
- The root `package.json` provides workspace scripts for both clients.
- `backend/` remains independent and can be started from `backend/server`.

## Troubleshooting

- If workspace install fails, run `npm install` from the repository root again.
- If the web app fails to start, verify `web/frontend/src/main.tsx` imports `./styles/index.css`.
- If the mobile app fails to start, confirm the native project files are available and installed.
- If backend errors occur, verify `backend/server/.env` and database settings.
