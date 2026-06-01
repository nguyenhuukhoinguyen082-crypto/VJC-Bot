// Bamboo Airways — API Client
import type { ApiError, User } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

const PANEL_GROUPS = new Set(["dev", "director", "staff"]);

function isCrossOriginApi(): boolean {
  if (typeof window === "undefined") return false;
  if (!API_URL.startsWith("http")) return false;
  try {
    return new URL(API_URL).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function getStoredToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem("access_token");
}

function storeSessionAuth(accessToken: string, userGroup: string) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem("access_token", accessToken);
  sessionStorage.setItem("user_group", userGroup);
}

function clearSessionAuth() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("user_group");
  sessionStorage.removeItem("csrf_token");
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getCsrfToken(): Promise<string> {
    // For cross-origin (iOS Safari compatibility), store token in sessionStorage
    if (isCrossOriginApi()) {
      let token = sessionStorage.getItem("csrf_token");
      if (!token) {
        const res = await fetch(`${this.baseUrl}/csrf-token`, { credentials: "include" });
        if (!res.ok) {
          throw new Error(`Failed to fetch CSRF token: ${res.status}`);
        }
        const data = await res.json();
        token = data.csrf_token;
        if (!token) {
          throw new Error("CSRF token endpoint returned empty token");
        }
        sessionStorage.setItem("csrf_token", token);
      }
      return token;
    }
    
    // Same-origin: rely on cookie
    const res = await fetch(`${this.baseUrl}/csrf-token`, { credentials: "include" });
    if (!res.ok) {
      throw new Error(`Failed to fetch CSRF token: ${res.status}`);
    }
    const data = await res.json();
    if (!data.csrf_token) {
      throw new Error("CSRF token endpoint returned empty token");
    }
    return data.csrf_token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (isCrossOriginApi()) {
      const token = getStoredToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  private async parseError(res: Response): Promise<string> {
    try {
      const error = await res.json();
      console.error("API Error:", res.status, error);
      if (Array.isArray(error.detail)) {
        return error.detail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join(", ");
      }
      return error.detail || "Request failed";
    } catch {
      console.error("API Error (parse failed):", res.status, res.statusText);
      return `Request failed (${res.status} ${res.statusText})`;
    }
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: this.getHeaders(),
      credentials: "include",
    });
    if (!res.ok) {
      const message = await this.parseError(res);
      throw { code: res.status, message } as ApiError;
    }
    return res.json();
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const csrfToken = await this.getCsrfToken();
    const headers = this.getHeaders();
    headers["X-CSRF-Token"] = csrfToken;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });
    if (!res.ok) {
      const message = await this.parseError(res);
      throw { code: res.status, message } as ApiError;
    }
    return res.json();
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const csrfToken = await this.getCsrfToken();
    const headers = this.getHeaders();
    headers["X-CSRF-Token"] = csrfToken;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (!res.ok) {
      const message = await this.parseError(res);
      throw { code: res.status, message } as ApiError;
    }
    return res.json();
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const csrfToken = await this.getCsrfToken();
    const headers = this.getHeaders();
    headers["X-CSRF-Token"] = csrfToken;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (!res.ok) {
      const message = await this.parseError(res);
      throw { code: res.status, message } as ApiError;
    }
    return res.json();
  }

  async delete<T>(path: string): Promise<T> {
    const csrfToken = await this.getCsrfToken();
    const headers = this.getHeaders();
    headers["X-CSRF-Token"] = csrfToken;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "DELETE",
      headers,
      credentials: "include",
    });
    if (!res.ok) {
      const message = await this.parseError(res);
      throw { code: res.status, message } as ApiError;
    }
    return res.json();
  }

  // --- Auth ---
  async login(nickname: string, password: string) {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, password }),
      credentials: "include",
    });
    if (!res.ok) {
      const message = await this.parseError(res);
      throw { code: res.status, message } as ApiError;
    }
    const data = await res.json();
    if (isCrossOriginApi() && data.access_token) {
      storeSessionAuth(data.access_token, data.user_group || "user");
    }
    return data;
  }

  async fetchMe(): Promise<(User & { user_id: string }) | null> {
    try {
      return await this.get<User & { user_id: string }>("/auth/me");
    } catch {
      return null;
    }
  }

  hasPanelAccess(): boolean {
    if (typeof sessionStorage === "undefined") return false;
    const group = sessionStorage.getItem("user_group");
    return group ? PANEL_GROUPS.has(group) : false;
  }

  async register(nickname: string, email: string, password: string, discord_id: string) {
    return this.post("/auth/register", { nickname, email, password, discord_id });
  }

  async verify(user_id: string, code: string) {
    return this.post("/auth/verify", { user_id, code });
  }

  async resendCode(user_id: string) {
    return this.post(`/auth/resend-code?user_id=${user_id}`);
  }

  async logout() {
    try {
      await this.post("/auth/logout");
    } catch {
      // Clear client state even if the request fails
    }
    clearSessionAuth();
  }
}

export const api = new ApiClient(API_URL);
