const API_URL = import.meta.env.VITE_APP_API_URL || "/api";

class ApiClient {
  private token: string | null = null;
  private refreshTokenValue: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    // Clear old token key (pre-refresh-token sessions)
    localStorage.removeItem("excalidraw-server-token");

    this.token = localStorage.getItem("excalidraw-access-token");
    this.refreshTokenValue = localStorage.getItem("excalidraw-refresh-token");
  }

  setTokens(accessToken: string | null, refreshToken?: string | null) {
    this.token = accessToken;
    if (accessToken) {
      localStorage.setItem("excalidraw-access-token", accessToken);
    } else {
      localStorage.removeItem("excalidraw-access-token");
    }

    if (refreshToken !== undefined) {
      this.refreshTokenValue = refreshToken;
      if (refreshToken) {
        localStorage.setItem("excalidraw-refresh-token", refreshToken);
      } else {
        localStorage.removeItem("excalidraw-refresh-token");
      }
    }
  }

  getToken(): string | null {
    return this.token;
  }

  getRefreshToken(): string | null {
    return this.refreshTokenValue;
  }

  private async tryRefreshToken(): Promise<string | null> {
    if (!this.refreshTokenValue) {
      return null;
    }

    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: this.refreshTokenValue }),
      });

      if (!res.ok) {
        this.logout();
        return null;
      }

      const data = await res.json();
      this.setTokens(data.accessToken);
      return data.accessToken;
    } catch {
      this.logout();
      return null;
    }
  }

  private async request<T = any>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    let res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    // Auto-refresh on 401
    if (res.status === 401 && this.refreshTokenValue) {
      // Deduplicate concurrent refresh calls
      if (!this.refreshPromise) {
        this.refreshPromise = this.tryRefreshToken();
      }
      const newToken = await this.refreshPromise;
      this.refreshPromise = null;

      if (newToken) {
        headers.Authorization = `Bearer ${newToken}`;
        res = await fetch(`${API_URL}${path}`, {
          ...options,
          headers,
        });
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    return res.json();
  }

  // Auth
  async register(email: string, password: string, name?: string) {
    const res = await this.request<{
      accessToken: string;
      refreshToken: string;
      user: any;
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    this.setTokens(res.accessToken, res.refreshToken);
    return res;
  }

  async login(email: string, password: string) {
    const res = await this.request<{
      accessToken: string;
      refreshToken: string;
      user: any;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    this.setTokens(res.accessToken, res.refreshToken);
    return res;
  }

  async getMe() {
    return this.request<{ user: any }>("/auth/me");
  }

  logout() {
    this.setTokens(null, null);
  }

  // Scenes
  async listScenes() {
    return this.request<{ scenes: any[] }>("/scenes");
  }

  async createScene(data: {
    title?: string;
    elements?: any[];
    appState?: any;
  }) {
    return this.request<{ scene: any }>("/scenes", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getScene(id: string) {
    return this.request<{ scene: any }>(`/scenes/${id}`);
  }

  async updateScene(
    id: string,
    data: { elements: any[]; appState?: any; title?: string },
  ) {
    return this.request<{ scene: any }>(`/scenes/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteScene(id: string) {
    return this.request(`/scenes/${id}`, { method: "DELETE" });
  }

  async renameScene(id: string, title: string) {
    return this.request<{ scene: any }>(`/scenes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  }

  async getSceneVersions(id: string) {
    return this.request<{ versions: any[] }>(`/scenes/${id}/versions`);
  }

  async getSceneVersion(id: string, version: number) {
    return this.request<{ version: any }>(`/scenes/${id}/versions/${version}`);
  }

  async restoreSceneVersion(id: string, version: number) {
    return this.request<{ scene: any }>(`/scenes/${id}/restore/${version}`, {
      method: "POST",
    });
  }

  async shareScene(id: string) {
    return this.request<{ scene: any }>(`/scenes/${id}/share`, {
      method: "POST",
    });
  }

  async getSharedScene(token: string) {
    return this.request<{ scene: any }>(`/scenes/shared/${token}`);
  }

  // Files
  async uploadFile(file: File, sceneId?: string, fileId?: string) {
    const formData = new FormData();
    formData.append("file", file);
    if (sceneId) {
      formData.append("sceneId", sceneId);
    }
    if (fileId) {
      formData.append("fileId", fileId);
    }

    const headers: Record<string, string> = {};
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_URL}/files`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    return res.json();
  }

  getFileUrl(id: string): string {
    return `${API_URL}/files/${id}`;
  }

  // Libraries
  async listLibraries() {
    return this.request<{ libraries: any[] }>("/libraries");
  }

  async createLibrary(data: {
    name?: string;
    items?: any[];
    isPublic?: boolean;
  }) {
    return this.request<{ library: any }>("/libraries", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateLibrary(
    id: string,
    data: { name?: string; items?: any[]; isPublic?: boolean },
  ) {
    return this.request<{ library: any }>(`/libraries/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteLibrary(id: string) {
    return this.request(`/libraries/${id}`, { method: "DELETE" });
  }

  // Teams
  async listTeams() {
    return this.request<{ teams: any[] }>("/teams");
  }

  async createTeam(name: string) {
    return this.request<{ team: any }>("/teams", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async getTeam(id: string) {
    return this.request<{ team: any; members: any[] }>(`/teams/${id}`);
  }

  async addTeamMember(teamId: string, email: string, role?: string) {
    return this.request(`/teams/${teamId}/members`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
  }

  async removeTeamMember(teamId: string, userId: string) {
    return this.request(`/teams/${teamId}/members/${userId}`, {
      method: "DELETE",
    });
  }

  // Collab persistence
  async getCollabScene(roomId: string) {
    return this.request<{
      sceneVersion: number;
      ciphertext: string | null;
      iv: string | null;
    }>(`/collab/scenes/${roomId}`);
  }

  async saveCollabScene(
    roomId: string,
    data: { sceneVersion: number; ciphertext: string; iv: string },
  ) {
    return this.request(`/collab/scenes/${roomId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();
export default api;
