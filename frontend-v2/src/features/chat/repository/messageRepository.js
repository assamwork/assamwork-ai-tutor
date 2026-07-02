import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../../lib/firebase";

class MessageRepository {
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
  }
}

export default new MessageRepository();