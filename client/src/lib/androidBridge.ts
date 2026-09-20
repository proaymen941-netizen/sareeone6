/**
 * Android Bridge - Web to Native App Interface
 * 
 * Provides a seamless connection between the React Web App and an Android Java APK Wrapper.
 * The Java WebView should inject a JavascriptInterface named "AndroidBridge".
 */

declare global {
  interface Window {
    AndroidBridge?: {
      /**
       * Shows a native push notification in the Android system tray.
       * @param title The title of the notification
       * @param message The body text of the notification
       */
      showNotification: (title: string, message: string) => void;
      
      /**
       * Requests location permissions directly from the Android OS.
       */
      requestLocationPermission: () => void;

      /**
       * Requests microphone permissions directly from the Android OS.
       */
      requestMicrophonePermission: () => void;

      /**
       * Requests push notification permissions directly from the Android OS (Android 13+).
       */
      requestNotificationPermission: () => void;
      
      /**
       * Notifies the native app about the logged-in driver's ID, 
       * allowing the app to subscribe to driver-specific push notification topics (like FCM).
       * @param driverId The current driver's unique ID
       */
      registerDriver: (driverId: string) => void;

      /**
       * Notifies the native app about the logged-in customer's ID,
       * allowing the app to subscribe to customer-specific push notification topics.
       * @param customerId The current customer's unique ID
       */
      registerCustomer: (customerId: string) => void;
      
      /**
       * Plays the native Android notification/ringtone sound.
       */
      playRingtone: () => void;
      
      /**
       * Stops the native Android ringtone.
       */
      stopRingtone: () => void;
      
      /**
       * Fetch Firebase Cloud Messaging (FCM) token from native app if configured.
       */
      getFCMToken: () => string;
      
      /**
       * Get API Key securely stored in the native Android App
       */
      getApiKey: () => string;
    };
  }
}

export const androidBridge = {
  isAvailable: (): boolean => {
    return typeof window !== 'undefined' && !!window.AndroidBridge;
  },
  showNotification: (title: string, message: string): boolean => {
    if (androidBridge.isAvailable() && window.AndroidBridge?.showNotification) {
      window.AndroidBridge.showNotification(title, message);
      return true;
    }
    return false;
  },
  requestLocationPermission: (): boolean => {
    if (androidBridge.isAvailable() && window.AndroidBridge?.requestLocationPermission) {
      window.AndroidBridge.requestLocationPermission();
      return true;
    }
    return false;
  },
  requestMicrophonePermission: (): boolean => {
    if (androidBridge.isAvailable() && window.AndroidBridge?.requestMicrophonePermission) {
      window.AndroidBridge.requestMicrophonePermission();
      return true;
    }
    return false;
  },
  requestNotificationPermission: (): boolean => {
    if (androidBridge.isAvailable() && window.AndroidBridge?.requestNotificationPermission) {
      window.AndroidBridge.requestNotificationPermission();
      return true;
    }
    return false;
  },
  registerDriver: (driverId: string): boolean => {
    if (androidBridge.isAvailable() && window.AndroidBridge?.registerDriver) {
      window.AndroidBridge.registerDriver(driverId);
      return true;
    }
    return false;
  },
  registerCustomer: (customerId: string): boolean => {
    if (androidBridge.isAvailable() && window.AndroidBridge?.registerCustomer) {
      window.AndroidBridge.registerCustomer(customerId);
      return true;
    }
    return false;
  },
  playRingtone: (): boolean => {
    if (androidBridge.isAvailable() && window.AndroidBridge?.playRingtone) {
      window.AndroidBridge.playRingtone();
      return true;
    }
    return false;
  },
  stopRingtone: (): boolean => {
    if (androidBridge.isAvailable() && window.AndroidBridge?.stopRingtone) {
      window.AndroidBridge.stopRingtone();
      return true;
    }
    return false;
  },
  getFCMToken: (): string | null => {
    if (androidBridge.isAvailable() && window.AndroidBridge?.getFCMToken) {
      return window.AndroidBridge.getFCMToken();
    }
    return null;
  },
  getApiKey: (): string | null => {
    if (androidBridge.isAvailable() && window.AndroidBridge?.getApiKey) {
      try {
        const key = window.AndroidBridge.getApiKey();
        if (key && typeof key === 'string' && key.trim()) {
          return key.trim();
        }
      } catch (err) {
        console.warn('AndroidBridge.getApiKey error:', err);
      }
    }
    // Fallback: check query parameter or localStorage
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlKey = urlParams.get('apiKey') || urlParams.get('key');
      if (urlKey) return urlKey;
      const storedKey = localStorage.getItem('saree_app_api_key');
      if (storedKey) return storedKey;
    }
    return null;
  }
};
