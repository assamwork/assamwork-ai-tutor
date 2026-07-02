import { Navigate } from "react-router-dom";

import { isAdmin } from "../../features/admin/services/adminAccess";
import useAuthStore from "../../store/authStore";

export default function AdminRoute({ children }) {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin(user)) {
    return <Navigate to="/study" replace />;
  }

  return children;
}
