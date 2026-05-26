import { io } from "socket.io-client";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export function mediaUrl(url) {
  if (!url) return "";
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

export function createSocket() {
  return io(API_URL, { transports: ["websocket", "polling"] });
}

export class ApiClient {
  constructor() {
    this.token = localStorage.getItem("momentra_token");
    this.refreshToken = localStorage.getItem("momentra_refresh");
  }

  setSession(session) {
    this.token = session.token;
    this.refreshToken = session.refreshToken ?? this.refreshToken;
    localStorage.setItem("momentra_token", this.token);
    if (this.refreshToken) localStorage.setItem("momentra_refresh", this.refreshToken);
  }

  clearSession() {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem("momentra_token");
    localStorage.removeItem("momentra_refresh");
  }

  async request(path, options = {}) {
    const headers = new Headers(options.headers ?? {});
    if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
    if (this.token) headers.set("Authorization", `Bearer ${this.token}`);
    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    if (!response.ok) {
      let payload;
      try {
        payload = await response.json();
      } catch {
        payload = { error: response.statusText };
      }
      throw new Error(payload.error ?? "Request failed");
    }
    if (response.status === 204) return null;
    return response.json();
  }

  get(path) {
    return this.request(path);
  }

  post(path, body) {
    return this.request(path, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body ?? {}) });
  }

  patch(path, body) {
    return this.request(path, { method: "PATCH", body: JSON.stringify(body ?? {}) });
  }

  delete(path) {
    return this.request(path, { method: "DELETE" });
  }
}

export const api = new ApiClient();
