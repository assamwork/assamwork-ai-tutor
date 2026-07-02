import { create } from "zustand";

const useUserStore = create((set) => ({
  user: null,

  loading: true,

  setUser: (user) =>
    set({
      user,
    }),

  setLoading: (loading) =>
    set({
      loading,
    }),

  clearUser: () =>
    set({
      user: null,
    }),
}));

export default useUserStore;