import { create } from "zustand";

import {
  observeAuth,
  logout,
} from "../features/auth/services/auth";

import { createUserIfNeeded } from "../features/auth/services/userService";

const useAuthStore = create((set) => ({
  user: null,
  loading: true,

  initialize() {
    return observeAuth(async (user) => {
      if (user) {
        try {
          await createUserIfNeeded(user);
        } catch (err) {
          console.error("Firestore Error:", err);
        }
      }

      set({
        user,
        loading: false,
      });
    });
  },

  logout: async () => {
    await logout();

    set({
      user: null,
    });
  },
}));

export default useAuthStore;