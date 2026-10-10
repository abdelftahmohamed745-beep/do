// Firebase Messaging Service Worker for Dawry Web Push Notifications
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize Firebase App in Service Worker
firebase.initializeApp({
  apiKey: "AIzaSy_demo_key",
  authDomain: "ai-studio-f8a934fa.firebaseapp.com",
  projectId: "ai-studio-f8a934fa",
  storageBucket: "ai-studio-f8a934fa.appspot.com",
  messagingSenderId: "632251661041",
  appId: "1:632251661041:web:dawryapp"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload);
  const notificationTitle = payload.notification?.title || 'تنبيه دوري - اقتراب موعد الدور';
  const notificationOptions = {
    body: payload.notification?.body || 'حجزك اقترب في العيادة، يرجى الاستعداد.',
    icon: '/assets/icon.png',
    badge: '/assets/icon.png',
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const clickAction = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === clickAction && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(clickAction);
      }
    })
  );
});
