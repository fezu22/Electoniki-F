/**
 * Frontend API client for ElectroHub SaaS.
 * Uses HTTP-only session cookies and in-memory auth header fallback.
 * Never stores secrets or passwords in localStorage.
 */

let inMemoryToken = null;

export function setSessionToken(token) {
  inMemoryToken = token || null;
}

export async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (inMemoryToken) {
    headers.Authorization = `Bearer ${inMemoryToken}`;
  }

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    signal,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const money = (v) =>
  'Rs. ' + Math.round(Number(v) || 0).toLocaleString('en-PK');

export const num = (v) => Math.max(0, Number(v) || 0);
