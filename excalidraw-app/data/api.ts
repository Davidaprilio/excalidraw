import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

const API_URL = import.meta.env.VITE_APP_API_URL || "/api";

export type WorkspaceRole = "admin" | "member";

type Session = { accessToken: string; refreshToken: string; user: any };

export interface Passkey {
  id: string;
  name: string;
  device_type: string | null;
  backed_up: boolean | null;
  created_at: string;
  last_used_at: string | null;
}

export interface SceneComment {
  id: string;
  body: string;
  author_id: string | null;
  author_name: string | null;
  author_avatar_version: string | null;
  created_at: string;
  edited_at: string | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
}

/** A comment thread pinned at (x, y) in scene coordinates */
export interface CommentThread {
  id: string;
  x: number;
  y: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by_name: string | null;
  comments: SceneComment[];
}

export interface SceneAccessUser {
  id: string;
  name: string | null;
  email: string;
  avatar_version: string | null;
  /** owner: the scene's owner; admin: workspace admin; editor: workspace member */
  access: "owner" | "admin" | "editor";
}

export interface SceneAccess {
  workspace: { id: string; name: string };
  collection: {
    id: string;
    name: string;
    visibility: "private" | "workspace";
  } | null;
  /** anyone with the share link can view it */
  is_shared: boolean;
  share_token: string | null;
  users: SceneAccessUser[];
}

export interface InviteSuggestion {
  id: string;
  name: string | null;
  email: string;
  avatar_version: string | null;
}

export interface SecurityOverview {
  totp: {
    enabled: boolean;
    enabledAt: string | null;
    recoveryCodesRemaining: number;
  };
  passkeys: Passkey[];
}

export interface Workspace {
  id: string;
  name: string;
  role: WorkspaceRole;
  member_count: number;
  scene_count: number;
  owner_id: string | null;
  owner_name?: string | null;
  is_owner: boolean;
  /** the owner's personal workspace: can't be deleted or left */
  is_personal: boolean;
  avatar_version: string | null;
}

export interface DeletedWorkspace extends Omit<Workspace, "role"> {
  deleted_at: string;
  deleted_by_name: string | null;
}

export interface Collection {
  id: string;
  name: string;
  visibility: "private" | "workspace";
  is_personal: boolean;
  owner_id: string | null;
  owner_name?: string;
  scene_count: number;
}

export interface SceneSummary {
  id: string;
  title: string;
  version: number;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
  owner_id: string;
  owner_name: string;
  updated_by_name: string | null;
  collection_id: string | null;
  collection_name: string | null;
  deleted_at: string | null;
  deleted_by_name: string | null;
  visited_at: string | null;
  thumbnail_version: number | null;
  has_content: boolean;
  can_delete_permanently: boolean;
  pinned: boolean;
}

export type SceneListView = "all" | "recent" | "visited" | "trash";

export interface WorkspaceMember {
  id: string;
  email: string;
  name: string;
  role: WorkspaceRole;
  joined_at: string;
  is_owner: boolean;
  avatar_version: string | null;
}

export interface WorkspaceInvite {
  id: string;
  email: string | null;
  role: WorkspaceRole;
  token: string;
  created_at: string;
  expires_at: string;
  invited_by_name?: string;
}

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

  /** fetch with the access token, refreshing it once on 401 */
  private async fetchWithAuth(
    path: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {
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

    return res;
  }

  private async request<T = any>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const res = await this.fetchWithAuth(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
      },
    });

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

  /** With two-factor on, resolves `{ mfaToken }`: finish with completeMfaLogin */
  async login(
    email: string,
    password: string,
  ): Promise<{ user: any } | { mfaToken: string }> {
    const res = await this.request<
      | { accessToken: string; refreshToken: string; user: any }
      | { mfaRequired: true; mfaToken: string }
    >("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if ("mfaRequired" in res) {
      return { mfaToken: res.mfaToken };
    }
    this.setTokens(res.accessToken, res.refreshToken);
    return res;
  }

  async completeMfaLogin(
    mfaToken: string,
    second: { code: string } | { recoveryCode: string },
  ) {
    const res = await this.request<Session>("/auth/login/mfa", {
      method: "POST",
      body: JSON.stringify({ mfaToken, ...second }),
    });
    this.setTokens(res.accessToken, res.refreshToken);
    return res;
  }

  /** Sign in with a passkey (the browser shows its passkey picker) */
  async loginWithPasskey() {
    const { options, challengeToken } = await this.request<{
      options: any;
      challengeToken: string;
    }>("/auth/passkeys/login/options", { method: "POST" });
    const response = await startAuthentication({ optionsJSON: options });
    const res = await this.request<Session>("/auth/passkeys/login/verify", {
      method: "POST",
      body: JSON.stringify({ challengeToken, response }),
    });
    this.setTokens(res.accessToken, res.refreshToken);
    return res;
  }

  // Security settings (two-factor + passkeys)
  async getSecurity() {
    return this.request<SecurityOverview>("/auth/security");
  }

  async startTotpSetup() {
    return this.request<{ secret: string; uri: string; qr: string }>(
      "/auth/mfa/totp/setup",
      { method: "POST" },
    );
  }

  async enableTotp(code: string) {
    return this.request<{ recoveryCodes: string[] }>("/auth/mfa/totp/enable", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  }

  async disableTotp(password: string) {
    return this.request("/auth/mfa/totp/disable", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  }

  async regenerateRecoveryCodes(password: string) {
    return this.request<{ recoveryCodes: string[] }>(
      "/auth/mfa/recovery-codes",
      { method: "POST", body: JSON.stringify({ password }) },
    );
  }

  /** Create a passkey on this device (the browser asks to confirm) */
  async registerPasskey(name: string) {
    const { options, challengeToken } = await this.request<{
      options: any;
      challengeToken: string;
    }>("/auth/passkeys/register/options", { method: "POST" });
    const response = await startRegistration({ optionsJSON: options });
    return this.request<{ passkey: Passkey }>(
      "/auth/passkeys/register/verify",
      {
        method: "POST",
        body: JSON.stringify({ challengeToken, response, name }),
      },
    );
  }

  async renamePasskey(id: string, name: string) {
    return this.request<{ passkey: Passkey }>(
      `/auth/passkeys/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify({ name }) },
    );
  }

  async deletePasskey(id: string) {
    return this.request(`/auth/passkeys/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async getMe() {
    return this.request<{ user: any }>("/auth/me");
  }

  async updateProfile(data: { name: string }) {
    return this.request<{ user: any }>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  /** Public URL of a profile photo, or null when the user has none */
  avatarUrl(userId: string, version: string | null | undefined) {
    return version ? `${API_URL}/users/${userId}/avatar?v=${version}` : null;
  }

  /** Public URL of a workspace photo, or null when it has none */
  workspaceAvatarUrl(workspaceId: string, version: string | null | undefined) {
    return version
      ? `${API_URL}/workspaces/${workspaceId}/avatar?v=${version}`
      : null;
  }

  async uploadWorkspaceAvatar(workspaceId: string, image: string) {
    return this.request(`/workspaces/${workspaceId}/avatar`, {
      method: "PUT",
      body: JSON.stringify({ image }),
    });
  }

  async deleteWorkspaceAvatar(workspaceId: string) {
    return this.request(`/workspaces/${workspaceId}/avatar`, {
      method: "DELETE",
    });
  }

  async uploadAvatar(image: string) {
    return this.request<{ user: any }>("/auth/me/avatar", {
      method: "PUT",
      body: JSON.stringify({ image }),
    });
  }

  async deleteAvatar() {
    return this.request<{ user: any }>("/auth/me/avatar", {
      method: "DELETE",
    });
  }

  /** Signs out other devices; this one keeps its session */
  async changePassword(currentPassword: string, newPassword: string) {
    return this.request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword,
        newPassword,
        refreshToken: this.refreshTokenValue,
      }),
    });
  }

  logout() {
    this.setTokens(null, null);
  }

  // Scenes
  async listScenes(params: {
    workspaceId: string;
    collectionId?: string;
    view?: SceneListView;
    q?: string;
    limit?: number;
  }) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        search.set(key, String(value));
      }
    }
    return this.request<{ scenes: SceneSummary[] }>(`/scenes?${search}`);
  }

  async createScene(data: {
    title?: string;
    elements?: any[];
    appState?: any;
    workspaceId?: string;
    collectionId?: string;
  }) {
    return this.request<{ scene: any }>("/scenes", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getScene(id: string) {
    return this.request<{ scene: any }>(`/scenes/${id}`);
  }

  /** who can open the scene and why (read only; managed from the dashboard) */
  async getSceneAccess(id: string) {
    return this.request<{ access: SceneAccess }>(`/scenes/${id}/access`);
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

  /** Moves the scene to the trash */
  async deleteScene(id: string) {
    return this.request(`/scenes/${id}`, { method: "DELETE" });
  }

  async restoreSceneFromTrash(id: string) {
    return this.request(`/scenes/${id}/untrash`, { method: "POST" });
  }

  async deleteScenePermanently(id: string) {
    return this.request(`/scenes/${id}/permanent`, { method: "DELETE" });
  }

  async moveScene(id: string, collectionId: string) {
    return this.request<{ scene: any }>(`/scenes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ collectionId }),
    });
  }

  /** Move to another workspace (into `collectionId`, or your Private collection there) */
  async transferScene(id: string, workspaceId: string, collectionId?: string) {
    return this.request<{ scene: any }>(`/scenes/${id}/transfer`, {
      method: "POST",
      body: JSON.stringify({ workspaceId, collectionId }),
    });
  }

  async setScenePinned(id: string, pinned: boolean) {
    return this.request(`/scenes/${id}/pin`, {
      method: pinned ? "POST" : "DELETE",
    });
  }

  async recordSceneVisit(id: string) {
    return this.request(`/scenes/${id}/visit`, { method: "POST" });
  }

  async renameScene(id: string, title: string) {
    return this.request<{ scene: any }>(`/scenes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  }

  async duplicateScene(id: string) {
    return this.request<{ scene: any }>(`/scenes/${id}/duplicate`, {
      method: "POST",
    });
  }

  /** Thumbnail image, or null if the scene has none yet */
  async getSceneThumbnail(id: string): Promise<Blob | null> {
    const res = await this.fetchWithAuth(`/scenes/${id}/thumbnail`);
    return res.ok ? res.blob() : null;
  }

  async saveSceneThumbnail(id: string, image: string, version: number) {
    return this.request<{ thumbnailVersion: number | null }>(
      `/scenes/${id}/thumbnail`,
      { method: "PUT", body: JSON.stringify({ image, version }) },
    );
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

  async unshareScene(id: string) {
    return this.request<{ scene: any }>(`/scenes/${id}/share`, {
      method: "DELETE",
    });
  }

  async getSharedScene(token: string) {
    return this.request<{ scene: any }>(`/scenes/shared/${token}`);
  }

  // Comments (threads pinned on a scene)
  async listComments(sceneId: string) {
    return this.request<{ threads: CommentThread[] }>(
      `/scenes/${sceneId}/comments`,
    );
  }

  async createCommentThread(
    sceneId: string,
    data: { body: string; x: number; y: number },
  ) {
    return this.request<{ thread: CommentThread }>(
      `/scenes/${sceneId}/comments`,
      { method: "POST", body: JSON.stringify(data) },
    );
  }

  async replyToThread(sceneId: string, threadId: string, body: string) {
    return this.request<{ thread: CommentThread }>(
      `/scenes/${sceneId}/comments/${threadId}/replies`,
      { method: "POST", body: JSON.stringify({ body }) },
    );
  }

  /** Resolve / reopen, or move the pin */
  async updateThread(
    sceneId: string,
    threadId: string,
    data: { resolved?: boolean; x?: number; y?: number },
  ) {
    return this.request<{ thread: CommentThread }>(
      `/scenes/${sceneId}/comments/${threadId}`,
      { method: "PATCH", body: JSON.stringify(data) },
    );
  }

  async deleteThread(sceneId: string, threadId: string) {
    return this.request(`/scenes/${sceneId}/comments/${threadId}`, {
      method: "DELETE",
    });
  }

  async editComment(
    sceneId: string,
    threadId: string,
    commentId: string,
    body: string,
  ) {
    return this.request<{ thread: CommentThread }>(
      `/scenes/${sceneId}/comments/${threadId}/replies/${commentId}`,
      { method: "PATCH", body: JSON.stringify({ body }) },
    );
  }

  /** Add my reaction, or remove it when already there */
  async toggleReaction(
    sceneId: string,
    threadId: string,
    commentId: string,
    emoji: string,
  ) {
    return this.request<{ thread: CommentThread }>(
      `/scenes/${sceneId}/comments/${threadId}/replies/${commentId}/reactions`,
      { method: "POST", body: JSON.stringify({ emoji }) },
    );
  }

  /** Resolves `thread: null` when that was its last comment (thread deleted) */
  async deleteComment(sceneId: string, threadId: string, commentId: string) {
    return this.request<{ thread: CommentThread | null }>(
      `/scenes/${sceneId}/comments/${threadId}/replies/${commentId}`,
      { method: "DELETE" },
    );
  }

  // Workspaces
  async listWorkspaces() {
    return this.request<{ workspaces: Workspace[] }>("/workspaces");
  }

  async createWorkspace(name: string) {
    return this.request<{ workspace: Workspace }>("/workspaces", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async renameWorkspace(id: string, name: string) {
    return this.request(`/workspaces/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
  }

  /** Moves the workspace (owner only, not personal) to its owner's trash */
  async deleteWorkspace(id: string) {
    return this.request(`/workspaces/${id}`, { method: "DELETE" });
  }

  async listDeletedWorkspaces() {
    return this.request<{ workspaces: DeletedWorkspace[] }>(
      "/workspaces/deleted",
    );
  }

  async restoreWorkspace(id: string) {
    return this.request(`/workspaces/${id}/restore`, { method: "POST" });
  }

  async deleteWorkspacePermanently(id: string) {
    return this.request(`/workspaces/${id}/permanent`, { method: "DELETE" });
  }

  async transferWorkspaceOwnership(id: string, userId: string) {
    return this.request(`/workspaces/${id}/transfer`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  }

  /**
   * Leave a workspace. The owner must pass `newOwnerId`; resolves
   * `{ lastMember: true }` when nobody is left to hand it to.
   */
  async leaveWorkspace(
    id: string,
    newOwnerId?: string,
  ): Promise<{ lastMember: boolean }> {
    const res = await this.fetchWithAuth(`/workspaces/${id}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newOwnerId }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 409 && body.code === "last_member") {
      return { lastMember: true };
    }
    if (!res.ok) {
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return { lastMember: false };
  }

  async listMembers(workspaceId: string) {
    return this.request<{ members: WorkspaceMember[] }>(
      `/workspaces/${workspaceId}/members`,
    );
  }

  async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ) {
    return this.request(`/workspaces/${workspaceId}/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  }

  /** Remove another member (admins). To leave, use leaveWorkspace. */
  async removeMember(workspaceId: string, userId: string) {
    return this.request(`/workspaces/${workspaceId}/members/${userId}`, {
      method: "DELETE",
    });
  }

  async listInvites(workspaceId: string) {
    return this.request<{ invites: WorkspaceInvite[] }>(
      `/workspaces/${workspaceId}/invites`,
    );
  }

  /** Registered users matching `q`, to pick from when inviting (admins only) */
  async inviteSuggestions(workspaceId: string, q: string) {
    return this.request<{ enabled: boolean; users: InviteSuggestion[] }>(
      `/workspaces/${workspaceId}/invite-suggestions?q=${encodeURIComponent(
        q,
      )}`,
    );
  }

  /** Without email: a link anyone can use to join */
  async createInvite(
    workspaceId: string,
    data: { email?: string; role: WorkspaceRole },
  ) {
    return this.request<{ invite: WorkspaceInvite }>(
      `/workspaces/${workspaceId}/invites`,
      { method: "POST", body: JSON.stringify(data) },
    );
  }

  async revokeInvite(workspaceId: string, inviteId: string) {
    return this.request(`/workspaces/${workspaceId}/invites/${inviteId}`, {
      method: "DELETE",
    });
  }

  async getInvite(token: string) {
    return this.request<{
      invite: {
        workspaceId: string;
        workspaceName: string;
        workspaceAvatarVersion: string | null;
        invitedByName: string | null;
        role: WorkspaceRole;
        email: string | null;
        alreadyMember: boolean;
      };
    }>(`/invites/${token}`);
  }

  async acceptInvite(token: string) {
    return this.request<{ workspaceId: string }>(`/invites/${token}/accept`, {
      method: "POST",
    });
  }

  // Collections
  async listCollections(workspaceId: string) {
    return this.request<{ collections: Collection[] }>(
      `/workspaces/${workspaceId}/collections`,
    );
  }

  async createCollection(
    workspaceId: string,
    data: { name: string; visibility: Collection["visibility"] },
  ) {
    return this.request<{ collection: Collection }>(
      `/workspaces/${workspaceId}/collections`,
      { method: "POST", body: JSON.stringify(data) },
    );
  }

  async updateCollection(
    workspaceId: string,
    collectionId: string,
    data: { name?: string; visibility?: Collection["visibility"] },
  ) {
    return this.request(
      `/workspaces/${workspaceId}/collections/${collectionId}`,
      { method: "PATCH", body: JSON.stringify(data) },
    );
  }

  /** Its scenes are moved to the trash */
  async deleteCollection(workspaceId: string, collectionId: string) {
    return this.request(
      `/workspaces/${workspaceId}/collections/${collectionId}`,
      { method: "DELETE" },
    );
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

  // Collab room storage (encrypted by the client with the room key)
  async getCollabRoom(roomId: string) {
    const res = await this.fetchWithAuth(`/collab/rooms/${roomId}`);
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new Error(`Loading collab room failed (HTTP ${res.status})`);
    }
    return (await res.json()) as {
      sceneVersion: number;
      ciphertext: string;
      iv: string;
      revision: number;
    };
  }

  /** Resolves `{ conflict: true }` when someone else saved since `baseRevision` */
  async saveCollabRoom(
    roomId: string,
    data: {
      sceneVersion: number;
      ciphertext: string;
      iv: string;
      baseRevision: number | null;
    },
  ): Promise<{ conflict: true } | { conflict: false; revision: number }> {
    const res = await this.fetchWithAuth(`/collab/rooms/${roomId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.status === 409) {
      return { conflict: true };
    }
    if (!res.ok) {
      throw new Error(`Saving collab room failed (HTTP ${res.status})`);
    }
    return { conflict: false, revision: (await res.json()).revision };
  }

  async saveCollabFiles(roomId: string, files: { id: string; data: string }[]) {
    return this.request<{ savedFiles: string[]; erroredFiles: string[] }>(
      `/collab/rooms/${roomId}/files`,
      { method: "POST", body: JSON.stringify({ files }) },
    );
  }

  async getCollabFile(roomId: string, fileId: string) {
    const res = await this.fetchWithAuth(
      `/collab/rooms/${roomId}/files/${fileId}`,
    );
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  }
}

export const api = new ApiClient();
export default api;
