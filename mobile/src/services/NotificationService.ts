// Notification Service - Push Notifications
import messaging from '@react-native-firebase/messaging';
import PushNotification, { Importance } from 'react-native-push-notification';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Initialize Push Notifications
export const setupNotifications = async () => {
  // Create notification channel (Android)
  if (Platform.OS === 'android') {
    PushNotification.createChannel(
      {
        channelId: 'crime-alerts',
        channelName: 'Crime Alerts',
        channelDescription: 'Notifications for nearby crimes and high-risk zones',
        playSound: true,
        soundName: 'default',
        importance: Importance.HIGH,
        vibrate: true,
      },
      (created: boolean) => console.log(`Crime alerts channel created: ${created}`)
    );

    PushNotification.createChannel(
      {
        channelId: 'emergency',
        channelName: 'Emergency',
        channelDescription: 'Emergency SOS notifications',
        playSound: true,
        soundName: 'default',
        importance: Importance.HIGH,
        vibrate: true,
      },
      (created: boolean) => console.log(`Emergency channel created: ${created}`)
    );
  }

  // Configure local notifications
  PushNotification.configure({
    // Called when a remote is received or opened
    onNotification: function (notification: any) {
      console.log('NOTIFICATION:', notification);
      
      // Handle notification tap
      if (notification.userInteraction) {
        handleNotificationTap(notification);
      }
    },

    // Android only: GCM or FCM Sender ID
    senderID: 'YOUR_FCM_SENDER_ID',

    // iOS only
    permissions: {
      alert: true,
      badge: true,
      sound: true,
    },

    popInitialNotification: true,
    requestPermissions: Platform.OS === 'ios',
  });

  // Request FCM permission (iOS 10+)
  await requestNotificationPermission();

  // Get FCM token
  await getFCMToken();

  // Listen for foreground messages
  messaging().onMessage(async (remoteMessage) => {
    console.log('Foreground message:', remoteMessage);
    showLocalNotification(remoteMessage);
  });

  // Listen for background messages
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('Background message:', remoteMessage);
  });

  // Listen for token refresh
  messaging().onTokenRefresh(async (token) => {
    console.log('FCM Token refreshed:', token);
    await AsyncStorage.setItem('fcmToken', token);
    // TODO: Send token to backend
  });
};

// Request notification permission
const requestNotificationPermission = async () => {
  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('Notification permission granted');
    } else {
      console.log('Notification permission denied');
    }

    return enabled;
  } catch (error) {
    console.error('Request permission error:', error);
    return false;
  }
};

// Get FCM Token
const getFCMToken = async () => {
  try {
    const token = await messaging().getToken();
    console.log('FCM Token:', token);
    await AsyncStorage.setItem('fcmToken', token);
    
    // TODO: Send token to backend for push notifications
    // await api.post('/users/fcm-token', { token });
    
    return token;
  } catch (error) {
    console.error('Get FCM token error:', error);
    return null;
  }
};

// Show local notification
export const showLocalNotification = (data: any) => {
  const title = data.notification?.title || data.title || 'Risk Radar';
  const message = data.notification?.body || data.body || '';
  const channelId = data.data?.type === 'emergency' ? 'emergency' : 'crime-alerts';

  PushNotification.localNotification({
    channelId,
    title,
    message,
    playSound: true,
    soundName: 'default',
    importance: 'high',
    vibrate: true,
    vibration: 300,
    priority: 'high',
    userInfo: data.data || {},
    largeIcon: 'ic_launcher',
    smallIcon: 'ic_notification',
  });
};

// Schedule local notification
export const scheduleNotification = (
  title: string,
  message: string,
  date: Date,
  channelId: string = 'crime-alerts'
) => {
  PushNotification.localNotificationSchedule({
    channelId,
    title,
    message,
    date,
    allowWhileIdle: true,
  });
};

// Clear all notifications
export const clearAllNotifications = () => {
  PushNotification.cancelAllLocalNotifications();
};

// Handle notification tap
const handleNotificationTap = (notification: any) => {
  const { data } = notification;

  if (data?.screen) {
    // Navigate to specific screen
    // This requires navigation ref to be set up
    console.log('Navigate to:', data.screen);
  }

  if (data?.crimeId) {
    // Navigate to crime detail
    console.log('Show crime:', data.crimeId);
  }
};

// Show crime alert notification
export const showCrimeAlert = (crime: any) => {
  showLocalNotification({
    title: `🚨 ${crime.type_name} nearby`,
    body: crime.title || 'Crime reported in your area',
    data: {
      type: 'crime',
      crimeId: crime.id,
      screen: 'CrimeDetail',
    },
  });
};

// Show high-risk zone alert
export const showRiskZoneAlert = (area: any) => {
  showLocalNotification({
    title: '⚠️ High Risk Zone',
    body: `You are entering ${area.name}. Stay alert!`,
    data: {
      type: 'risk',
      areaId: area.id,
    },
  });
};

// Show emergency notification
export const showEmergencyAlert = (location: string) => {
  showLocalNotification({
    title: '🆘 Emergency Alert',
    body: `SOS alert from ${location}`,
    data: {
      type: 'emergency',
      screen: 'Emergency',
    },
  });
};

export default {
  setupNotifications,
  showLocalNotification,
  scheduleNotification,
  clearAllNotifications,
  showCrimeAlert,
  showRiskZoneAlert,
  showEmergencyAlert,
};
