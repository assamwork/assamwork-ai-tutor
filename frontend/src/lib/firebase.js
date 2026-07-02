import { initializeApp } from "firebase/app";

import {
  getAuth,
  GoogleAuthProvider,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDuCYw83g8hXA5GveSvWZ2sJVgzlI0oWTY",
  authDomain: "assamwork-ai.firebaseapp.com",
  projectId: "assamwork-ai",
  storageBucket: "assamwork-ai.firebasestorage.app",
  messagingSenderId: "257189432829",
  appId: "1:257189432829:web:a7d29ac87c820f416c9d94",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();

export default app;