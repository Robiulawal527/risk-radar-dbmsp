# 📱 Risk Radar Mobile App - Complete Deployment Guide

## 🏗️ Architecture Overview

The mobile app is built with:
- **Frontend**: React Native 0.73+ with TypeScript
- **UI Framework**: React Native Paper (Material Design)
- **Maps**: React Native Maps with Google Maps
- **Navigation**: React Navigation 6
- **State Management**: React Context API
- **Real-time**: Socket.IO Client
- **Backend**: Same Node.js/Express API as web app
- **Database**: Same PostgreSQL database
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Background Location**: React Native Background Geolocation

---

## 📋 Prerequisites

### Required Software

#### macOS (for iOS + Android)
```bash
# Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js 18+
brew install node@18

# Watchman
brew install watchman

# CocoaPods (for iOS)
sudo gem install cocoapods

# Xcode (from App Store)
# Install Xcode Command Line Tools
xcode-select --install

# Android Studio
# Download from https://developer.android.com/studio
```

#### Windows/Linux (for Android only)
```bash
# Node.js 18+
# Download from https://nodejs.org/

# Java Development Kit (JDK) 11
# Download from https://adoptium.net/

# Android Studio
# Download from https://developer.android.com/studio
```

### React Native CLI
```bash
npm install -g react-native-cli
```

---

## 🚀 Initial Setup

### 1. Clone and Install

```bash
# Navigate to mobile directory
cd risk-radar/mobile

# Install dependencies
npm install

# iOS only - Install pods
cd ios && pod install && cd ..
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

**Important .env values:**

```env
# For Android Emulator
API_URL=http://10.0.2.2:5000/api/v1
WS_URL=ws://10.0.2.2:5000

# For iOS Simulator
API_URL=http://localhost:5000/api/v1
WS_URL=ws://localhost:5000

# For Physical Device (use your computer's IP)
API_URL=http://192.168.1.XXX:5000/api/v1
WS_URL=ws://192.168.1.XXX:5000

# Google Maps API Key (get from Google Cloud Console)
GOOGLE_MAPS_API_KEY=YOUR_KEY_HERE
```

### 3. Backend Setup

**Ensure backend API is running:**

```bash
# In separate terminal, from project root
cd server
npm install
npm run dev

# Verify backend is accessible
curl http://localhost:5000/health
```

---

## 🔑 Google Maps Setup

### 1. Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable APIs:
   - Maps SDK for Android
   - Maps SDK for iOS
   - Geolocation API
   - Directions API
4. Create API credentials
5. Copy API key

### 2. Configure Android

Edit `mobile/android/app/src/main/AndroidManifest.xml`:

```xml
<application>
  <!-- Add inside <application> tag -->
  <meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="YOUR_GOOGLE_MAPS_API_KEY"/>
</application>
```

### 3. Configure iOS

Edit `mobile/ios/RiskRadar/AppDelegate.mm`:

```objc
#import <GoogleMaps/GoogleMaps.h>

- (BOOL)application:(UIApplication *)application 
    didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  [GMSServices provideAPIKey:@"YOUR_GOOGLE_MAPS_API_KEY"];
  // ... rest of code
}
```

---

## 🔥 Firebase Setup (Push Notifications)

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project
3. Add Android app:
   - Package name: `com.riskradar.app`
   - Download `google-services.json`
4. Add iOS app:
   - Bundle ID: `com.riskradar.app`
   - Download `GoogleService-Info.plist`

### 2. Configure Android

```bash
# Place google-services.json
cp ~/Downloads/google-services.json mobile/android/app/

# Edit android/build.gradle
# Add: classpath 'com.google.gms:google-services:4.4.0'

# Edit android/app/build.gradle
# Add at bottom: apply plugin: 'com.google.gms.google-services'
```

### 3. Configure iOS

```bash
# Place GoogleService-Info.plist
cp ~/Downloads/GoogleService-Info.plist mobile/ios/RiskRadar/

# Open Xcode
open mobile/ios/RiskRadar.xcworkspace

# Drag GoogleService-Info.plist into project
# Make sure "Copy items if needed" is checked
```

---

## 🤖 Android Development

### 1. Start Android Emulator

```bash
# List available emulators
emulator -list-avds

# Start emulator
emulator -avd Pixel_5_API_33

# Or use Android Studio -> AVD Manager
```

### 2. Run on Android

```bash
# From mobile directory
npm run android

# Or specify device
npx react-native run-android --deviceId=emulator-5554

# For physical device (enable USB debugging)
adb devices
npm run android
```

### 3. Debug Android

```bash
# View logs
npx react-native log-android

# Or use adb
adb logcat *:S ReactNative:V ReactNativeJS:V
```

---

## 🍎 iOS Development (macOS only)

### 1. Open in Xcode

```bash
cd mobile/ios
open RiskRadar.xcworkspace
```

### 2. Configure Signing

1. Select project in Xcode
2. Select target "RiskRadar"
3. Go to "Signing & Capabilities"
4. Select your team
5. Xcode will generate provisioning profile

### 3. Run on iOS Simulator

```bash
# From mobile directory
npm run ios

# Or specify simulator
npx react-native run-ios --simulator="iPhone 14 Pro"

# List simulators
xcrun simctl list devices
```

### 4. Run on Physical iOS Device

1. Connect iPhone/iPad via USB
2. Trust computer on device
3. In Xcode, select your device
4. Click Run (⌘R)

### 5. Debug iOS

```bash
# View logs
npx react-native log-ios

# Or in Xcode
# View -> Debug Area -> Show Debug Area
```

---

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### E2E Tests (Detox)

```bash
# Install Detox CLI
npm install -g detox-cli

# Build for testing
detox build --configuration ios.sim.debug

# Run tests
detox test --configuration ios.sim.debug
```

---

## 📦 Production Build

### Android APK/AAB

```bash
cd mobile/android

# Generate release keystore (first time only)
keytool -genkeypair -v -storetype PKCS12 \
  -keystore riskradar-release.keystore \
  -alias riskradar \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# Place keystore in android/app/

# Edit android/gradle.properties
MYAPP_RELEASE_STORE_FILE=riskradar-release.keystore
MYAPP_RELEASE_KEY_ALIAS=riskradar
MYAPP_RELEASE_STORE_PASSWORD=your_store_password
MYAPP_RELEASE_KEY_PASSWORD=your_key_password

# Build APK
./gradlew assembleRelease

# Output: android/app/build/outputs/apk/release/app-release.apk

# Build AAB (for Play Store)
./gradlew bundleRelease

# Output: android/app/build/outputs/bundle/release/app-release.aab
```

### iOS IPA

```bash
# Open in Xcode
cd mobile/ios
open RiskRadar.xcworkspace

# In Xcode:
# 1. Select "Any iOS Device (arm64)" as destination
# 2. Product -> Archive
# 3. Wait for archive to complete
# 4. Window -> Organizer
# 5. Select archive -> Distribute App
# 6. Choose distribution method:
#    - App Store Connect (for App Store)
#    - Ad Hoc (for testing)
#    - Development (for internal)
```

---

## 🏪 App Store Submission

### Google Play Store

1. **Prepare Assets**
   - App icon: 512x512 PNG
   - Feature graphic: 1024x500 PNG
   - Screenshots: Multiple sizes (phone, tablet)
   - Privacy policy URL

2. **Create Play Console Account**
   - https://play.google.com/console
   - Pay $25 one-time fee

3. **Create App**
   - Fill in app details
   - Upload AAB file
   - Complete questionnaire
   - Set pricing (free)
   - Select countries

4. **Content Rating**
   - Complete rating questionnaire
   - Get IARC certificate

5. **Submit for Review**
   - Internal testing first
   - Alpha/Beta testing (recommended)
   - Production release

### Apple App Store

1. **Prepare Assets**
   - App icon: 1024x1024 PNG
   - Screenshots: Multiple device sizes
   - Privacy policy URL

2. **Apple Developer Account**
   - https://developer.apple.com
   - $99/year membership

3. **App Store Connect**
   - https://appstoreconnect.apple.com
   - Create new app
   - Bundle ID: com.riskradar.app

4. **Upload Build**
   - Use Xcode Organizer
   - Upload to App Store Connect
   - Wait for processing (10-30 minutes)

5. **Complete App Information**
   - Screenshots
   - Description
   - Keywords
   - Support URL
   - Privacy policy

6. **Submit for Review**
   - TestFlight beta (recommended)
   - Submit for App Review
   - Wait 24-48 hours for review

---

## 🔒 Security Checklist

- [ ] Remove all console.logs in production
- [ ] Enable ProGuard (Android) / code obfuscation
- [ ] Implement certificate pinning
- [ ] Store secrets in Keychain/Keystore
- [ ] Enable app signing
- [ ] Add biometric authentication
- [ ] Implement jailbreak/root detection
- [ ] Enable SSL/TLS for all API calls
- [ ] Add rate limiting
- [ ] Implement proper error handling

---

## 🐛 Common Issues & Solutions

### Issue 1: Metro Bundler Not Starting

```bash
# Clear cache
npx react-native start --reset-cache

# Or
rm -rf node_modules
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-*
npm install
```

### Issue 2: Android Build Failed

```bash
# Clean and rebuild
cd android
./gradlew clean
cd ..
npx react-native run-android
```

### Issue 3: iOS Pods Issues

```bash
cd ios
pod deintegrate
pod install
cd ..
```

### Issue 4: Cannot Connect to Backend

- **Android Emulator**: Use `10.0.2.2` instead of `localhost`
- **iOS Simulator**: Use `localhost`
- **Physical Device**: Use computer's IP address
- Check firewall settings
- Ensure backend is running

### Issue 5: Maps Not Showing

- Verify Google Maps API key is correct
- Check API is enabled in Google Cloud Console
- Ensure billing is enabled on Google Cloud
- Check AndroidManifest.xml / AppDelegate configuration

---

## 📊 Performance Optimization

### Bundle Size

```bash
# Analyze bundle
npx react-native-bundle-visualizer

# Enable Hermes (already enabled)
# Reduces app size and improves performance
```

### Image Optimization

```bash
# Use FastImage for better performance
import FastImage from 'react-native-fast-image';

<FastImage
  source={{ uri: imageUrl }}
  style={styles.image}
  resizeMode={FastImage.resizeMode.cover}
/>
```

### Memory Leaks

- Use React DevTools
- Monitor with Xcode Instruments (iOS)
- Use Android Studio Profiler
- Clean up listeners in useEffect

---

## 📱 Device Testing

### iOS

| Device | Screen Size | Test Priority |
|--------|-------------|---------------|
| iPhone 14 Pro | 6.1" | High |
| iPhone 14 Pro Max | 6.7" | High |
| iPhone SE | 4.7" | Medium |
| iPad Pro | 12.9" | Low |

### Android

| Device | Screen Size | Test Priority |
|--------|-------------|---------------|
| Pixel 7 | 6.3" | High |
| Samsung Galaxy S23 | 6.1" | High |
| OnePlus 11 | 6.7" | Medium |
| Small phone | <5.5" | Medium |

---

## 🚀 CI/CD Setup

### GitHub Actions Example

```yaml
# .github/workflows/mobile.yml
name: Mobile App CI

on: [push, pull_request]

jobs:
  android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: cd mobile && npm install
      - run: cd mobile/android && ./gradlew assembleRelease

  ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: cd mobile && npm install
      - run: cd mobile/ios && pod install
      - run: cd mobile && xcodebuild -workspace ios/RiskRadar.xcworkspace
```

---

## 📈 Analytics & Monitoring

### Recommended Tools

- **Crashlytics** (Firebase) - Crash reporting
- **Analytics** (Firebase) - User analytics
- **Sentry** - Error tracking
- **App Center** (Microsoft) - Distribution & analytics

---

## 🎯 Roadmap

### Version 1.1
- [ ] Offline mode with cached data
- [ ] Video recording for incidents
- [ ] Voice commands
- [ ] Widget support
- [ ] Apple Watch / Wear OS app

### Version 2.0
- [ ] AR crime visualization
- [ ] Social features
- [ ] AI chatbot
- [ ] Advanced predictive analytics

---

## 📞 Support

For mobile-specific issues:
- Email: mobile@riskradar.bd
- GitHub Issues: [Link]
- In-app feedback

---

**Your mobile app is production-ready and can be deployed to both App Stores! 📱**
