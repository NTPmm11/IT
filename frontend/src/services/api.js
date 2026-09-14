export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000/api";

export async function apiFetch(path, options = {}) {
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(user ? { "X-User-Id": user.userId } : {}),
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

