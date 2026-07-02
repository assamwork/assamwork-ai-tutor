import { useEffect } from "react";
import useAuthStore from "../../../store/authStore";

export default function AuthProvider({ children }) {
  const initialize = useAuthStore((state) => state.initialize);
  const loading = useAuthStore((state) => state.loading);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    const unsubscribe = initialize();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [initialize]);

  console.log("Firebase User:", user);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <h2 className="text-xl font-semibold">
          Loading AssamWork AI...
        </h2>
      </div>
    );
  }

  return children;
}