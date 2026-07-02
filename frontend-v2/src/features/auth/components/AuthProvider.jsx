import { useEffect } from "react";
import useAuthStore from "../../../store/authStore";

export default function AuthProvider({ children }) {
  const initialize = useAuthStore((state) => state.initialize);
  const loading = useAuthStore((state) => state.loading);

  useEffect(() => {
    const unsubscribe = initialize();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [initialize]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 px-4">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <h2 className="mt-4 text-lg font-bold text-slate-900">
            Loading AssamWork AI
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Preparing your secure study workspace…
          </p>
        </div>
      </div>
    );
  }

  return children;
}
