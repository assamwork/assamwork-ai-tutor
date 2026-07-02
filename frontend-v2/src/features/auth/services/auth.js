import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";

import { auth } from "../../../lib/firebase";

const provider = new GoogleAuthProvider();

export function loginWithGoogle() {
  return signInWithPopup(auth, provider);
}

export function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(
    auth,
    email,
    password
  );
}

export function registerWithEmail(email, password) {
  return createUserWithEmailAndPassword(
    auth,
    email,
    password
  );
}

export function logout() {
  return signOut(auth);
}

export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}