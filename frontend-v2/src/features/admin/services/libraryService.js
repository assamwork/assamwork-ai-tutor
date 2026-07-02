import { auth } from "../../../lib/firebase";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function getToken() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Authentication is required.");
  }

  return user.getIdToken();
}

async function readError(response, fallback) {
  try {
    const data = await response.json();
    const detail = data.detail;

    if (typeof detail === "string") return detail;
    if (typeof detail?.message === "string") return detail.message;

    return fallback;
  } catch {
    return fallback;
  }
}

async function requestError(response, fallback) {
  const error = new Error(await readError(response, fallback));
  error.status = response.status;
  return error;
}

export async function getLibrary({ signal } = {}) {
  const token = await getToken();
  const response = await fetch(`${API_URL}/library`, {
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw await requestError(
      response,
      "Unable to load the ebook library. Please try again."
    );
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("The library response is invalid.");
  }

  return data;
}

export async function uploadBook({ file, subject, signal } = {}) {
  const token = await getToken();
  const form = new FormData();
  form.append("file", file);
  form.append("subject", subject);

  const response = await fetch(`${API_URL}/admin/library/upload`, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!response.ok) {
    throw await requestError(
      response,
      "Upload failed. Please try again."
    );
  }

  return response.json();
}

export async function deleteBook({ subject, book, signal } = {}) {
  const token = await getToken();
  const response = await fetch(`${API_URL}/admin/library/book`, {
    method: "DELETE",
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject,
      book,
    }),
  });

  if (!response.ok) {
    throw await requestError(
      response,
      "Delete failed. Please try again."
    );
  }

  return response.json();
}

export async function reindexLibrary({ signal } = {}) {
  const token = await getToken();
  const response = await fetch(`${API_URL}/admin/library/reindex`, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw await requestError(
      response,
      "Re-index failed. Check backend logs and try again."
    );
  }

  return response.json();
}

export async function getReindexStatus({ signal } = {}) {
  const token = await getToken();
  const response = await fetch(
    `${API_URL}/admin/library/reindex/status`,
    {
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw await requestError(
      response,
      "Unable to load indexing status."
    );
  }

  return response.json();
}

export async function getSystemStatus({ signal } = {}) {
  const token = await getToken();
  const response = await fetch(`${API_URL}/admin/system/status`, {
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw await requestError(
      response,
      "Unable to load system status."
    );
  }

  return response.json();
}
