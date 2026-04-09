declare module 'react-native-push-notification' {
  export const Importance: {
    HIGH: string | number;
    DEFAULT: string | number;
    LOW: string | number;
    MAX: string | number;
    MIN: string | number;
  };

  interface PushNotificationOptions {
    channelId?: string;
    title?: string;
    message?: string;
    playSound?: boolean;
    soundName?: string;
    importance?: string | number;
    vibrate?: boolean;
    vibration?: number;
    priority?: string;
    userInfo?: any;
    largeIcon?: string;
    smallIcon?: string;
    date?: Date;
    allowWhileIdle?: boolean;
  }

  interface Notification {
    userInteraction?: boolean;
    data?: any;
    notification?: any;
  }

  function createChannel(config: any, callback: (created: boolean) => void): void;
  function configure(config: any): void;
  function localNotification(options: PushNotificationOptions): void;
  function localNotificationSchedule(options: PushNotificationOptions): void;
  function cancelAllLocalNotifications(): void;

  const PushNotification: {
    createChannel: typeof createChannel;
    configure: typeof configure;
    localNotification: typeof localNotification;
    localNotificationSchedule: typeof localNotificationSchedule;
    cancelAllLocalNotifications: typeof cancelAllLocalNotifications;
  };

  export default PushNotification;
}
