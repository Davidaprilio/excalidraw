// The workspace the dashboard shows and new scenes are created in (per browser)
const CURRENT_WORKSPACE_KEY = "excalidraw-workspace-id";

export const getStoredWorkspaceId = (): string | null => {
  try {
    return localStorage.getItem(CURRENT_WORKSPACE_KEY);
  } catch {
    return null;
  }
};

export const setStoredWorkspaceId = (id: string) => {
  try {
    localStorage.setItem(CURRENT_WORKSPACE_KEY, id);
  } catch {
    // storage unavailable (private mode); the dashboard falls back to the first workspace
  }
};
