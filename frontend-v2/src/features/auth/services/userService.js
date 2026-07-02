import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../../../lib/firebase";

export async function createUserIfNeeded(user) {
  if (!user) return;

  const userRef = doc(db, "users", user.uid);

  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      name: user.displayName || "",
      email: user.email || "",
      photoURL: user.photoURL || "",

      plan: "Free",
      subscription: null,

      totalChats: 0,
      tokensUsed: 0,

      provider: user.providerData?.[0]?.providerId || "password",

      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    });
  } else {
    await updateDoc(userRef, {
      lastLogin: serverTimestamp(),
      name: user.displayName || "",
      photoURL: user.photoURL || "",
    });
  }

  const profileSnapshot = await getDoc(userRef);

  return profileSnapshot.exists()
    ? {
        id: profileSnapshot.id,
        ...profileSnapshot.data(),
      }
    : null;
}
