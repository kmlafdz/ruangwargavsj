import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyDbZLOCguZj4MmP4xbQrr6gln1arIdXhAg",
  authDomain: "ruang-warga-011-2607a.firebaseapp.com",
  projectId: "ruang-warga-011-2607a",
  storageBucket: "ruang-warga-011-2607a.firebasestorage.app",
  messagingSenderId: "574180261299",
  appId: "1:574180261299:web:f3a70b13ff1bc78e595fc6",
  measurementId: "G-GGXZEC2V4N"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Analytics only in browser
isSupported().then(yes => yes && getAnalytics(app));

export default app;
