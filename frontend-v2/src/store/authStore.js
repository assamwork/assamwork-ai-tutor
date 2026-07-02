import { create } from "zustand";

import {
  observeAuth,
  logout,
} from "../features/auth/services/auth";

import { createUserIfNeeded } from "../features/auth/services/userService";

const useAuthStore = create((set) => ({
  user: null,
  profile: null,
  loading: true,
  profileLoading: true,

  initialize() {
    return observeAuth(async (user) => {
      set({
        profileLoading: true,
      });

      let profile = null;

      if (user) {
        try {
          profile = await createUserIfNeeded(user);
        } catch (err) {
          console.error("Firestore Error:", err);
        }
      }

      set({
        user,
        profile,
        loading: false,
        profileLoading: false,
      });
    });
  },

  logout: async () => {
    await logout();

    set({
      user: null,
      profile: null,
    });
  },
}));

export default useAuthStore;
