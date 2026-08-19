
export const API_BASE =
  import.meta.env.VITE_API_BASE ?? "http://localhost:4000/api";

export function getToken() {
  return localStorage.getItem("token");
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

async function request(path, options = {}) {
  const token = getToken();

  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = res.status === 204 ? null : await res.json().catch(() => ({}));

  if (res.status === 401) {
    clearSession();
    if (window.location.pathname !== "/") window.location.href = "/";
    throw new Error(data?.error || "หมดเวลาใช้งาน กรุณา login ใหม่");
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return { res, data };
}

export async function apiFetch(path, options = {}) {
  const { data } = await request(path, options);
  return data;
}

export async function apiFetchPaged(path, options = {}) {
  const { res, data } = await request(path, options);
  const total = res.headers.get("X-Total-Count");
  return { rows: data ?? [], total: total === null ? (data?.length ?? 0) : Number(total) };
}
