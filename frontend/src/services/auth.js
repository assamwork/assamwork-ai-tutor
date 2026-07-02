import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

import { auth, googleProvider } from "../lib/firebase";

// Google Login
export function loginWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

// Email Login
export function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

// Email Signup
export function signupWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

// Logout
export function logout() {
  return signOut(auth);
}

// Auth Listener
export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}