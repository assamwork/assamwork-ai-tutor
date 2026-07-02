import { createContext, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../lib/firebase";
import useUserStore from "../store/userStore";

export const AuthContext = createContext();

export default function AuthProvider({ children }) {
  const {
    setUser,
    clearUser,
    setLoading,
  } = useUserStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser({
          uid: user.uid,
          name: user.displayName,
          email: user.email,
          photo: user.photoURL,
        });
      } else {
        clearUser();
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return children;
}