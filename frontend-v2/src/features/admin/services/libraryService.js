import { auth } from "../../../lib/firebase";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export async function getLibrary({ signal } = {}) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Authentication is required to load the library.");
  }

  const token = await user.getIdToken();
  const response = await fetch(`${API_URL}/library`, {
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Unable to load library (HTTP ${response.status})`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("The library response is invalid.");
  }

  return data;
}
