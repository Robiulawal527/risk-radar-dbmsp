# 📱 Risk Radar Mobile App (React Native)

Complete mobile application for iOS and Android platforms.

---

## 🏗️ Project Structure

```
mobile/
├── android/                 # Android native code
├── ios/                     # iOS native code
├── src/
│   ├── components/          # Reusable components
│   ├── screens/             # App screens
│   ├── navigation/          # Navigation setup
│   ├── services/            # API & services
│   ├── context/             # React Context
│   ├── hooks/               # Custom hooks
│   ├── utils/               # Utilities
│   ├── constants/           # Constants
│   ├── assets/              # Images, fonts
│   └── App.tsx              # Root component
├── package.json
├── tsconfig.json
├── metro.config.js
├── babel.config.js
├── app.json
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- React Native CLI
- Xcode (for iOS)
- Android Studio (for Android)
- CocoaPods (for iOS)

### Installation

```bash
# Navigate to mobile directory
cd mobile

# Install dependencies
npm install

# iOS setup
cd ios && pod install && cd ..

# Run on iOS
npm run ios

# Run on Android
npm run android
```

---

## 📦 Dependencies

### Core
- React Native 0.73+
- TypeScript
- React Navigation 6
- React Native Maps
- React Native Geolocation

### UI Components
- React Native Paper (Material Design)
- React Native Vector Icons
- React Native Elements
- React Native Animatable

### State & Data
- React Context API
- AsyncStorage
- Socket.IO Client
- Axios

### Features
- React Native Push Notifications
- React Native Background Geolocation
- React Native Permissions
- React Native Camera
- React Native Image Picker

---

## 🔐 Environment Setup

Create `.env` file:

```env
API_URL=http://localhost:5000/api/v1
WS_URL=ws://localhost:5000
GOOGLE_MAPS_API_KEY=your_key_here
```

---

## 📱 Features

### User Features
- ✅ Real-time crime map
- ✅ Heatmap visualization
- ✅ Crime reporting with photos
- ✅ Safe route navigation
- ✅ Emergency SOS button
- ✅ Push notifications
- ✅ Background location tracking
- ✅ Offline mode support

### Technical Features
- ✅ Biometric authentication
- ✅ Background geolocation
- ✅ Push notifications (FCM)
- ✅ Offline data caching
- ✅ Image compression
- ✅ Location-based alerts

---

## 🎨 UI/UX

### Design System
- Material Design 3 components
- Custom theme with brand colors
- Dark mode support
- Accessibility compliance
- Gesture-based navigation

### Screens
1. Splash Screen
2. Onboarding (first launch)
3. Login / Signup
4. Home (Map View)
5. Crime List
6. Crime Details
7. Report Crime
8. Safe Route Finder
9. Emergency SOS
10. Profile
11. Settings
12. Notifications

---

## 🗺️ Maps Integration

### React Native Maps
- Custom markers for crimes
- Heatmap overlay
- User location tracking
- Cluster markers
- Custom callouts
- Route drawing

---

## 🔔 Push Notifications

### Firebase Cloud Messaging
- Crime alerts near user
- High-risk zone warnings
- Emergency broadcast
- Custom notification sounds
- Notification badges

---

## 📍 Background Location

### React Native Background Geolocation
- Track user location in background
- Send location updates to server
- Trigger alerts based on location
- Battery optimization
- Geofencing support

---

## 📸 Camera Integration

### Crime Reporting
- Take photos of incidents
- Upload multiple images
- Image compression
- Gallery selection
- Photo annotations

---

## 🔒 Security

- Biometric authentication (Face ID / Touch ID / Fingerprint)
- Secure token storage (Keychain/Keystore)
- SSL certificate pinning
- Data encryption
- Secure API communication

---

## 🌐 Offline Support

- AsyncStorage for local data
- Queue failed requests
- Sync when connection restored
- Cached crime data
- Offline map tiles (optional)

---

## 🧪 Testing

```bash
# Unit tests
npm test

# E2E tests (Detox)
npm run test:e2e:ios
npm run test:e2e:android
```

---

## 📦 Build & Release

### iOS

```bash
# Build for testing
npm run ios -- --configuration Release

# Build for production
cd ios
xcodebuild -workspace RiskRadar.xcworkspace \
  -scheme RiskRadar \
  -configuration Release \
  -archivePath build/RiskRadar.xcarchive \
  archive
```

### Android

```bash
# Build APK
cd android
./gradlew assembleRelease

# Build AAB (for Play Store)
./gradlew bundleRelease
```

---

## 🔑 Required Permissions

### iOS (Info.plist)
- NSLocationWhenInUseUsageDescription
- NSLocationAlwaysUsageDescription
- NSCameraUsageDescription
- NSPhotoLibraryUsageDescription
- NSMicrophoneUsageDescription (for video)

### Android (AndroidManifest.xml)
- ACCESS_FINE_LOCATION
- ACCESS_COARSE_LOCATION
- ACCESS_BACKGROUND_LOCATION
- CAMERA
- READ_EXTERNAL_STORAGE
- WRITE_EXTERNAL_STORAGE
- INTERNET
- VIBRATE

---

## 📊 Performance

- Lazy loading screens
- Image optimization
- Memoization
- Virtual lists
- Background task optimization
- Memory leak prevention

---

## 🌍 Localization

- English
- Bangla (বাংলা)
- RTL support ready
- Date/time formatting
- Number formatting

---

## 🐛 Debugging

```bash
# iOS
npm run ios -- --simulator="iPhone 14 Pro"

# Android
npm run android -- --deviceId=emulator-5554

# React Native Debugger
npm install -g react-devtools
react-devtools

# Flipper (recommended)
# Install Flipper desktop app
```

---

## 📱 App Store Submission

### iOS App Store
1. Prepare app icons (1024x1024)
2. Screenshots for all device sizes
3. App description (English + Bangla)
4. Privacy policy URL
5. TestFlight beta testing
6. App Store Connect submission

### Google Play Store
1. App icons (512x512)
2. Feature graphic (1024x500)
3. Screenshots (phone + tablet)
4. Store listing
5. Content rating
6. Privacy policy
7. Internal testing → Production

---

## 🔄 Version Management

```bash
# Bump version
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0
```

---

## 📝 Changelog

### Version 1.0.0 (Initial Release)
- Complete crime tracking features
- Real-time map with heatmap
- Emergency SOS system
- Safe route finder
- Push notifications
- Background location tracking
- Multi-language support

---

## 🤝 Backend Integration

Mobile app connects to the same backend API:
- Base URL: `http://your-api-url.com/api/v1`
- WebSocket: `ws://your-api-url.com`
- All existing 33 API endpoints supported

---

## 🎯 Roadmap

### Version 1.1
- [ ] Offline maps
- [ ] Video recording for incidents
- [ ] Voice commands
- [ ] Apple Watch / Wear OS support
- [ ] Widget support
- [ ] Shortcuts integration

### Version 2.0
- [ ] AR crime visualization
- [ ] Social features (community)
- [ ] AI chatbot support
- [ ] Advanced analytics
- [ ] Crowdsourced safety ratings

---

## 📞 Support

For issues or questions:
- Email: mobile@riskradar.bd
- GitHub Issues
- In-app feedback

---

**Mobile app complements the web platform with native features and better performance! 📱**
