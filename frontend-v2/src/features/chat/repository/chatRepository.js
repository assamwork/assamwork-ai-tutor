import {
  collection,
  addDoc,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  increment,
} from "firebase/firestore";

import { db } from "../../../lib/firebase";

class ChatRepository {
  async createChat(uid, title = "New AI Tutor Chat") {
    const ref = await addDoc(
      collection(db, "users", uid, "chats"),
      {
        title,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        messageCount: 0,
      }
    );

    try {
      await this.syncTotalChats(uid);
    } catch (error) {
      console.error("Unable to update totalChats:", error);
    }

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
    const messagesRef = collection(
      db,
      "users",
      uid,
      "chats",
      chatId,
      "messages"
    );
    const messagesSnapshot = await getDocs(messagesRef);
    const documents = [
      ...messagesSnapshot.docs.map((message) => message.ref),
      doc(db, "users", uid, "chats", chatId),
    ];

    for (let index = 0; index < documents.length; index += 500) {
      const batch = writeBatch(db);

      documents
        .slice(index, index + 500)
        .forEach((documentRef) => batch.delete(documentRef));

      await batch.commit();
    }

    try {
      await this.syncTotalChats(uid);
    } catch (error) {
      console.error("Unable to update totalChats:", error);
    }
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

  async addMessage(
    uid,
    chatId,
    role,
    content,
    sources = [],
    title = null
  ) {
    const messageRef = doc(
      collection(
        db,
        "users",
        uid,
        "chats",
        chatId,
        "messages"
      )
    );
    const chatRef = doc(db, "users", uid, "chats", chatId);
    const batch = writeBatch(db);

    batch.set(messageRef, {
      role,
      content,
      sources,
      createdAt: serverTimestamp(),
    });

    const chatUpdate = {
      updatedAt: serverTimestamp(),
      messageCount: increment(1),
    };

    if (title?.trim()) {
      chatUpdate.title = title.trim();
    }

    batch.update(chatRef, chatUpdate);
    await batch.commit();

    return messageRef.id;
  }

  async syncTotalChats(uid) {
    const snapshot = await getDocs(
      collection(db, "users", uid, "chats")
    );

    await setDoc(
      doc(db, "users", uid),
      {
        totalChats: snapshot.size,
      },
      {
        merge: true,
      }
    );
  }
}

export default new ChatRepository();
