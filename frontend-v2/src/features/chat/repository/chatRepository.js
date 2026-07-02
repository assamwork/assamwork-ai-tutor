import {
  collection,
  addDoc,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../../lib/firebase";

class ChatRepository {
  async createChat(uid, title = "New Chat") {
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

  async getChats(uid) {
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

  async getChat(uid, chatId) {
    const snapshot = await getDoc(
      doc(db, "users", uid, "chats", chatId)
    );

    if (!snapshot.exists()) return null;

    return {
      id: snapshot.id,
      ...snapshot.data(),
    };
  }

  async renameChat(uid, chatId, title) {
    await updateDoc(
      doc(db, "users", uid, "chats", chatId),
      {
        title,
        updatedAt: serverTimestamp(),
      }
    );
  }

  async deleteChat(uid, chatId) {
    await deleteDoc(
      doc(db, "users", uid, "chats", chatId)
    );
  }

  async getMessages(uid, chatId) {
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

  async addMessage(uid, chatId, role, content) {
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

    await updateDoc(
      doc(db, "users", uid, "chats", chatId),
      {
        updatedAt: serverTimestamp(),
      }
    );
  }
}

export default new ChatRepository();