const API_URL = "http://127.0.0.1:8000";

export async function askAI(question) {
  const response = await fetch(
    `${API_URL}/ask?question=${encodeURIComponent(question)}`
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.json();
}