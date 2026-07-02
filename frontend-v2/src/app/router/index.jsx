import React, { Suspense, lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";
import MainLayout from "@/components/layout/MainLayout";

const AuthPage = lazy(() => import("@/features/auth/pages/AuthPage"));
const ChatPage = lazy(() => import("@/features/chat/pages/ChatPage"));
const ProfilePage = lazy(() => import("@/features/profile/pages/ProfilePage"));
const SettingsPage = lazy(() => import("@/features/settings/pages/SettingsPage"));
const StudyPage = lazy(() => import("@/features/study/pages/StudyPage"));

function Loader() {
  return (
    <div className="flex h-screen items-center justify-center text-lg font-semibold">
      Loading AssamWork AI...
    </div>
  );
}

const Load = (Component) => (
  <Suspense fallback={<Loader />}>
    <Component />
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },

  {
    path: "/login",
    element: Load(AuthPage),
  },

  {
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: "/chat",
        element: Load(ChatPage),
      },
      {
        path: "/study",
        element: Load(StudyPage),
      },
      {
        path: "/profile",
        element: Load(ProfilePage),
      },
      {
        path: "/settings",
        element: Load(SettingsPage),
      },
    ],
  },

  {
    path: "*",
    element: <Navigate to="/login" replace />,
  },
]);