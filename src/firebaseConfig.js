import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCWrCB0PZSGtn4FqlKo9_jVe6O1f5Krz0M",
  authDomain: "realtimechat2025.firebaseapp.com",
  projectId: "realtimechat2025",
  storageBucket: "realtimechat2025.firebasestorage.app",
  messagingSenderId: "250748950155",
  appId: "1:250748950155:web:02dafd403e09293e34268e",
  measurementId: "G-N7XB2RND6W",
};

const app = initializeApp(firebaseConfig);

const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const realtimeDb = getDatabase(app);
