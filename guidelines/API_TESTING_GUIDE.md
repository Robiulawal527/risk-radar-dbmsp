# 🧪 Risk Radar API Testing Guide

Complete guide to test all backend API endpoints.

## 📋 Prerequisites

- Backend server running on `http://localhost:5000`
- Tool: Postman, cURL, or any REST client
- Sample credentials (see below)

---

## 🔐 Authentication Endpoints

### 1. Register New User

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Test123!",
  "fullName": "Test User",
  "phone": "01712345678"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "test@example.com",
      "fullName": "Test User",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2. Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@riskradar.bd",
  "password": "admin123"
}
```

**Save the token from response for subsequent requests!**

### 3. Get Current User

```http
GET /api/v1/auth/me
Authorization: Bearer YOUR_TOKEN_HERE
```

### 4. Update Profile

```http
PUT /api/v1/auth/profile
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "fullName": "Updated Name",
  "phone": "01798765432"
}
```

---

## 🚨 Crime Endpoints

### 5. Get All Crimes

```http
GET /api/v1/crimes?limit=50&offset=0
```

**With Filters:**
```http
GET /api/v1/crimes?type=theft&area=Gulshan&severity=4&startDate=2025-01-01&endDate=2025-04-09
```

**Geographic Filter:**
```http
GET /api/v1/crimes?lat=23.8103&lng=90.4125&radius=5
```

### 6. Get Crime by ID

```http
GET /api/v1/crimes/CRIME_UUID_HERE
```

### 7. Create Crime Report

```http
POST /api/v1/crimes
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "crimeTypeId": "theft",
  "title": "Motorcycle theft reported",
  "description": "Black motorcycle stolen from parking",
  "latitude": 23.8103,
  "longitude": 90.4125,
  "incidentDate": "2025-04-08T14:30:00Z",
  "severity": 3,
  "victimsCount": 1,
  "suspectsCount": 2,
  "policeCaseNumber": "GD-2025-001"
}
```

### 8. Update Crime (Admin/Police Only)

```http
PUT /api/v1/crimes/CRIME_UUID_HERE
Authorization: Bearer ADMIN_TOKEN_HERE
Content-Type: application/json

{
  "status": "investigating",
  "is_verified": true,
  "severity": 4
}
```

### 9. Delete Crime (Admin Only)

```http
DELETE /api/v1/crimes/CRIME_UUID_HERE
Authorization: Bearer ADMIN_TOKEN_HERE
```

### 10. Get Crime Types

```http
GET /api/v1/crimes/types
```

### 11. Get Nearby Crimes

```http
GET /api/v1/crimes/nearby?lat=23.8103&lng=90.4125&radius=5
```

---

## 📍 Area Endpoints

### 12. Get All Areas

```http
GET /api/v1/areas
```

### 13. Get Area by ID

```http
GET /api/v1/areas/AREA_UUID_HERE
```

### 14. Get High-Risk Areas

```http
GET /api/v1/areas/risk/high
```

---

## 📊 Analytics Endpoints

### 15. Get Statistics

```http
GET /api/v1/analytics/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_crimes": 350,
      "last_30_days": 45,
      "last_7_days": 12,
      "today": 3,
      "avg_severity": 3.2,
      "areas_affected": 8
    },
    "byType": [...],
    "monthlyTrend": [...]
  }
}
```

### 16. Get Area Statistics

```http
GET /api/v1/analytics/areas
```

### 17. Get AI Predictions

```http
GET /api/v1/analytics/predictions
```

---

## 🔔 Notification Endpoints

### 18. Get User Notifications

```http
GET /api/v1/notifications
Authorization: Bearer YOUR_TOKEN_HERE
```

### 19. Mark Notification as Read

```http
PUT /api/v1/notifications/NOTIFICATION_UUID/read
Authorization: Bearer YOUR_TOKEN_HERE
```

### 20. Mark All Notifications as Read

```http
PUT /api/v1/notifications/read-all
Authorization: Bearer YOUR_TOKEN_HERE
```

---

## 🛣️ Safe Route Endpoints

### 21. Calculate Safe Route

```http
POST /api/v1/routes/calculate
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "startLat": 23.8103,
  "startLng": 90.4125,
  "endLat": 23.7465,
  "endLng": 90.3765
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "route": {
      "id": "uuid",
      "distance_km": 8.5,
      "risk_score": 45.3
    },
    "riskLevel": "medium",
    "crimeCount": 12,
    "safetyScore": 54.7
  }
}
```

### 22. Get Saved Routes

```http
GET /api/v1/routes/saved
Authorization: Bearer YOUR_TOKEN_HERE
```

---

## 🚨 Emergency Endpoints

### 23. Send SOS Alert

```http
POST /api/v1/emergency/sos
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "latitude": 23.8103,
  "longitude": 90.4125,
  "emergencyType": "robbery",
  "message": "Need immediate help!"
}
```

### 24. Get Active SOS Alerts (Police/Admin Only)

```http
GET /api/v1/emergency/sos/active
Authorization: Bearer POLICE_TOKEN_HERE
```

### 25. Update SOS Status (Police/Admin Only)

```http
PUT /api/v1/emergency/sos/SOS_UUID_HERE
Authorization: Bearer POLICE_TOKEN_HERE
Content-Type: application/json

{
  "status": "responded"
}
```

---

## 👥 User Management Endpoints (Admin Only)

### 26. Get All Users

```http
GET /api/v1/users
Authorization: Bearer ADMIN_TOKEN_HERE
```

### 27. Get User by ID

```http
GET /api/v1/users/USER_UUID_HERE
Authorization: Bearer ADMIN_TOKEN_HERE
```

### 28. Update User

```http
PUT /api/v1/users/USER_UUID_HERE
Authorization: Bearer ADMIN_TOKEN_HERE
Content-Type: application/json

{
  "role": "police",
  "is_active": true
}
```

---

## 🧪 Complete Testing Flow

### Scenario 1: New User Registration & Crime Reporting

```bash
# 1. Register
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "citizen@example.com",
    "password": "Secure123!",
    "fullName": "John Doe"
  }'

# Save token from response

# 2. Report a crime
curl -X POST http://localhost:5000/api/v1/crimes \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "crimeTypeId": "theft",
    "title": "Bag stolen",
    "latitude": 23.8103,
    "longitude": 90.4125,
    "incidentDate": "2025-04-09T10:00:00Z",
    "severity": 3
  }'

# 3. View nearby crimes
curl "http://localhost:5000/api/v1/crimes/nearby?lat=23.8103&lng=90.4125&radius=2"

# 4. Calculate safe route
curl -X POST http://localhost:5000/api/v1/routes/calculate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startLat": 23.8103,
    "startLng": 90.4125,
    "endLat": 23.7465,
    "endLng": 90.3765
  }'
```

### Scenario 2: Admin Managing System

```bash
# 1. Login as admin
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@riskradar.bd",
    "password": "admin123"
  }'

# 2. Get all crimes
curl "http://localhost:5000/api/v1/crimes?limit=100" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 3. Verify a crime
curl -X PUT http://localhost:5000/api/v1/crimes/CRIME_ID \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "is_verified": true,
    "status": "verified"
  }'

# 4. Get analytics
curl http://localhost:5000/api/v1/analytics/stats \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 5. Get all users
curl http://localhost:5000/api/v1/users \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Scenario 3: Emergency SOS

```bash
# 1. User sends SOS
curl -X POST http://localhost:5000/api/v1/emergency/sos \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 23.8103,
    "longitude": 90.4125,
    "emergencyType": "assault",
    "message": "Under attack, need help!"
  }'

# 2. Police views active SOS
curl http://localhost:5000/api/v1/emergency/sos/active \
  -H "Authorization: Bearer POLICE_TOKEN"

# 3. Police responds
curl -X PUT http://localhost:5000/api/v1/emergency/sos/SOS_ID \
  -H "Authorization: Bearer POLICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "responded"
  }'
```

---

## 🔌 WebSocket Testing

### Using JavaScript Console

```javascript
// 1. Connect to WebSocket
const token = 'YOUR_JWT_TOKEN';
const socket = io('http://localhost:5000', {
  auth: { token }
});

// 2. Listen for events
socket.on('connect', () => {
  console.log('✓ Connected');
});

socket.on('risk:alert', (data) => {
  console.log('⚠️ Risk Alert:', data);
});

socket.on('crime:nearby', (data) => {
  console.log('🚨 Nearby Crime:', data);
});

socket.on('emergency:new', (data) => {
  console.log('🆘 New Emergency:', data);
});

// 3. Send location update
socket.emit('location:update', {
  latitude: 23.8103,
  longitude: 90.4125,
  accuracy: 10
});

// 4. Send emergency SOS
socket.emit('emergency:sos', {
  latitude: 23.8103,
  longitude: 90.4125,
  emergencyType: 'robbery',
  message: 'Help!'
});
```

---

## 🧪 Postman Collection

Import this collection into Postman:

```json
{
  "info": {
    "name": "Risk Radar API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:5000/api/v1"
    },
    {
      "key": "token",
      "value": ""
    }
  ],
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Register",
          "request": {
            "method": "POST",
            "url": "{{base_url}}/auth/register",
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"test@example.com\",\n  \"password\": \"Test123!\",\n  \"fullName\": \"Test User\"\n}"
            }
          }
        }
      ]
    }
  ]
}
```

---

## ✅ Validation Checklist

Test each endpoint for:

- [ ] **Success Case**: Valid data returns 200/201
- [ ] **Authentication**: Unauthorized returns 401
- [ ] **Authorization**: Forbidden returns 403
- [ ] **Validation**: Invalid data returns 400
- [ ] **Not Found**: Non-existent resource returns 404
- [ ] **Server Error**: Handles errors gracefully with 500

---

## 📊 Performance Testing

```bash
# Use Apache Bench for load testing
ab -n 1000 -c 10 -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/v1/crimes

# Or use k6
k6 run --vus 10 --duration 30s load-test.js
```

---

## 🐛 Common Issues & Solutions

### Issue 1: 401 Unauthorized
- **Solution**: Ensure token is included in Authorization header
- **Format**: `Authorization: Bearer YOUR_TOKEN`

### Issue 2: 500 Server Error
- **Check**: Backend logs in `server/logs/error.log`
- **Verify**: Database connection is active

### Issue 3: CORS Error
- **Solution**: Verify `FRONTEND_URL` in backend `.env`
- **Check**: Request origin matches allowed origins

### Issue 4: Database Connection Failed
- **Solution**: Verify PostgreSQL is running
- **Check**: Database credentials in `.env`

---

## 📝 Notes

- All timestamps should be in ISO 8601 format
- Coordinates: latitude (-90 to 90), longitude (-180 to 180)
- Severity: 1 (low) to 5 (critical)
- Default pagination: limit=500, offset=0
- Rate limit: 100 requests per 15 minutes per IP

---

**Happy Testing! 🚀**
