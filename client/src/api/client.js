/**
 * Thin fetch wrapper.
 *
 * - Attaches the JWT from localStorage to every request.
 * - Throws an Error carrying `status` and `payload` so callers can react to
 *   specific responses (e.g. 409 = itinerary time conflict).
 */
const BASE = import.meta.env.VITE_API_BASE_URL || '';
const TOKEN_KEY = 'gtp.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const error = new Error(payload?.message || `Request failed (${res.status})`);
    error.status = res.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  del: (path) => request('DELETE', path),
};
