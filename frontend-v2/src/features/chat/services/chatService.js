import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../../lib/firebase";

/* ---------- Chats ---------- */

export async function createChat(uid, title = "New Chat") {
  const ref = await addDoc(
    collection(db, "users", uid, "chats"),
    {
      title,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  );

  return ref.id;
}

export async function getChats(uid) {
  const q = query(
    collection(db, "users", uid, "chats"),
    orderBy("updatedAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/* ---------- Messages ---------- */

export async function addMessage(
  uid,
  chatId,
  role,
  content
) {
  await addDoc(
    collection(
      db,
      "users",
      uid,
      "chats",
      chatId,
      "messages"
    ),
    {
      role,
      content,
      createdAt: serverTimestamp(),
    }
  );

  await setDoc(
    doc(db, "users", uid, "chats", chatId),
    {
      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    }
  );
}

export async function getMessages(uid, chatId) {
  const q = query(
    collection(
      db,
      "users",
      uid,
      "chats",
      chatId,
      "messages"
    ),
    orderBy("createdAt")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}