# Risk Radar

See the risk. Avoid the danger. Stay ahead.

Risk Radar is a full-stack public-safety platform for Bangladesh with a Vite web app, Expo React Native mobile app, Node.js/Express API, PostgreSQL/PostGIS schema, role-based access, real-time safety reporting, heatmap-oriented crime visualization, analytics, safe routing, emergency SOS, and English/Bangla UI copy.

## Apps

- `src/app`: responsive web dashboard for users, police, and admins.
- `mobile`: Expo React Native app for iOS, Android, and mobile web.
- `server`: Express REST API with JWT auth, RBAC, WebSocket events, and PostgreSQL.
- `database`: PostgreSQL/PostGIS schema and seed-ready data model.

## Run Locally

```bash
npm install
npm --prefix server install
npm --prefix mobile install
npm run dev:api
npm run dev:web
npm run dev:mobile
```

Create `server/.env` from your deployment values:

```bash
NODE_ENV=development
PORT=5000
API_VERSION=v1
JWT_SECRET=replace-me
JWT_EXPIRE=7d
DB_HOST=localhost
DB_PORT=5432
DB_NAME=riskradar_db
DB_USER=riskradar_user
DB_PASSWORD=replace-me
FRONTEND_URL=http://localhost:3000
```

For the web app, set `VITE_API_URL=http://localhost:5000/api/v1`. For the mobile app, set `EXPO_PUBLIC_API_URL=http://localhost:5000/api/v1`.

## Feature Coverage

- Authentication, signup/login, JWT sessions, admin/user/police role checks.
- Admin crime CRUD, category reads, dashboard statistics, high-risk areas.
- Interactive crime map and heat zones for Bangladesh.
- Location-based nearby crime data and risk-near-me alerts.
- Filtering by type, area, severity, date-compatible REST parameters.
- Crime details panel, report creation, real-time admin/police notifications.
- SOS and feeling-unsafe emergency alerts.
- Area risk score, trend analytics, hotspot detection, AI-style risk predictions.
- Safe-route scoring API.
- Criminal profile ranking plus private victim and volunteer profile tables/routes.
- English and Bangla mobile copy.
