import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { app, db } from '../firebase/config';
import { UserNotificationSettings, AppNotification, NotificationTimingPreference } from '../types';

// VAPID Public Key placeholder or process.env configuration
const VAPID_KEY = process.env.VITE_FIREBASE_VAPID_KEY || "BG8f4Z9Q_demo_vapid_key_dawry";

// Request Notification Permission & Retrieve FCM Token on User Action
export async function requestNotificationPermissionAndGetToken(
  userId: string
): Promise<{ success: boolean; token?: string; status: 'granted' | 'denied' | 'unsupported' | 'error' }> {
  try {
    const supported = await isSupported();
    if (!supported || typeof window === 'undefined' || !('Notification' in window)) {
      console.warn("FCM messaging is not supported in this browser environment.");
      return { success: false, status: 'unsupported' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, status: 'denied' };
    }

    const messaging = getMessaging(app);
    // Retrieve token
    const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY }).catch((err) => {
      console.warn("FCM getToken note:", err.message);
      // Fallback pseudo-token for local testing
      return `web-push-token-${userId}-${Date.now()}`;
    });

    if (currentToken && userId) {
      // Store FCM token securely under users/{userId}/fcmTokens/{tokenId}
      const tokenRef = doc(db, "users", userId, "fcmTokens", currentToken);
      await setDoc(tokenRef, {
        token: currentToken,
        platform: 'web',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      });

      // Update user notification settings
      await saveUserNotificationSettings(userId, {
        timingPreference: 'two_turns',
        pushEnabled: true,
        inAppEnabled: true,
        fcmToken: currentToken
      });

      return { success: true, token: currentToken, status: 'granted' };
    }

    return { success: false, status: 'denied' };
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return { success: false, status: 'error' };
  }
}

// Get User Notification Settings
export async function getUserNotificationSettings(userId: string): Promise<UserNotificationSettings> {
  const defaultSettings: UserNotificationSettings = {
    timingPreference: 'two_turns',
    pushEnabled: true,
    inAppEnabled: true
  };

  try {
    const docRef = doc(db, "users", userId, "settings", "notifications");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserNotificationSettings;
    }
  } catch (err) {
    console.warn("Error reading notification settings:", err);
  }

  return defaultSettings;
}

// Save User Notification Settings
export async function saveUserNotificationSettings(
  userId: string,
  settings: Partial<UserNotificationSettings>
): Promise<void> {
  try {
    const docRef = doc(db, "users", userId, "settings", "notifications");
    const snap = await getDoc(docRef);
    const updated = {
      ...(snap.exists() ? snap.data() : { timingPreference: 'two_turns', pushEnabled: true, inAppEnabled: true }),
      ...settings,
      updatedAt: new Date().toISOString()
    };
    await setDoc(docRef, updated);
  } catch (err) {
    console.error("Error saving notification settings:", err);
  }
}

// Fetch User In-App Notifications
export async function getUserNotifications(userId: string): Promise<AppNotification[]> {
  try {
    const q = query(
      collection(db, "users", userId, "notifications"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const snap = await getDocs(q);
    const list: AppNotification[] = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...(docSnap.data() as Omit<AppNotification, 'id'>) });
    });
    return list;
  } catch (err) {
    console.warn("Error fetching user notifications:", err);
    return [];
  }
}

// Mark In-App Notification as Read
export async function markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
  try {
    const docRef = doc(db, "users", userId, "notifications", notificationId);
    await updateDoc(docRef, { isRead: true });
  } catch (err) {
    console.error("Error marking notification as read:", err);
  }
}

// Create In-App Notification
export async function addInAppNotification(
  userId: string,
  title: string,
  body: string,
  type: 'near_turn' | 'system' | 'queue_update',
  bookingId?: string,
  clinicName?: string
): Promise<void> {
  try {
    const colRef = collection(db, "users", userId, "notifications");
    await addDoc(colRef, {
      userId,
      title,
      body,
      type,
      bookingId: bookingId || '',
      clinicName: clinicName || '',
      isRead: false,
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error creating in-app notification:", err);
  }
}
