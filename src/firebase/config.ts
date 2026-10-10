import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";

const firebaseConfigData = {
  projectId: "prefab-groove-502023-t4",
  appId: "1:550616569553:web:606d26205000e039de17f0",
  apiKey: "AIzaSyCcS-iNhEkZ80ryW6AGS854ERxXBklYSyE",
  authDomain: "prefab-groove-502023-t4.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-f8a934fa-e4dd-4561-8d66-6ad00154589f",
  storageBucket: "prefab-groove-502023-t4.firebasestorage.app",
  messagingSenderId: "550616569553",
  measurementId: "",
  oAuthClientId: "550616569553-g5dfs5jh6jl969n5retfgj5geernv5qk.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// Initialize Firebase using the configuration from firebase-applet-config.json
const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'ar';

// Initialize Firestore with persistentLocalCache for ultra-fast reads and offline resilience
const databaseId = firebaseConfigData.firestoreDatabaseId || "(default)";
let db: ReturnType<typeof getFirestore>;

try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  }, databaseId);
} catch {
  db = getFirestore(app, databaseId);
}

export { app, auth, db };
