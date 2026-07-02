import { RouterProvider } from "react-router-dom";

import { router } from "./app/router";

import AuthProvider from "./features/auth/components/AuthProvider";
import ChatInitializer from "./features/chat/components/ChatInitializer";

export default function App() {
  return (
    <AuthProvider>
      <ChatInitializer>
        <RouterProvider router={router} />
      </ChatInitializer>
    </AuthProvider>
  );
}