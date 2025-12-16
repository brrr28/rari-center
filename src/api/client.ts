type Json = Record<string, any>;

export class ApiError extends Error {
  status: number;
  details?: any;
  constructor(message: string, status: number, details?: any) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function getBaseUrl() {
  const url = import.meta.env.VITE_API_BASE_URL;
  if (!url) throw new Error("VITE_API_BASE_URL is not set.");
  return url.replace(/\/$/, "");
}

function getToken() {
  return import.meta.env.VITE_API_TOKEN;
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const base = getBaseUrl();
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  const url = `${base}${path}${qs}`;

  const headers: HeadersInit = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { method: "GET", headers });
  const text = await res.text();
  const data = safeJson(text);

  if (!res.ok)
    throw new ApiError(data?.message || `HTTP ${res.status}`, res.status, data);
  return data as T;
}

export async function apiPost<T>(path: string, body: Json): Promise<T> {
  const base = getBaseUrl();
  const url = `${base}${path}`;

  const headers: HeadersInit = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = safeJson(text);

  if (!res.ok)
    throw new ApiError(data?.message || `HTTP ${res.status}`, res.status, data);
  return data as T;
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
