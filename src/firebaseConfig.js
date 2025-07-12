import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyC-7laZLAb1G83dbrDhcQCHlqSrHhUELiM",
  authDomain: "realtimechat2-6e9b5.firebaseapp.com",
  projectId: "realtimechat2-6e9b5",
  storageBucket: "realtimechat2-6e9b5.firebasestorage.app",
  messagingSenderId: "96586974491",
  appId: "1:96586974491:web:e0b703ad4acc628e4b3fbe",
  measurementId: "G-9C3PPKETZ5",
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
