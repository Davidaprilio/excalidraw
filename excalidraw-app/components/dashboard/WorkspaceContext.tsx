import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import api from "../../data/api";
import { serverData } from "../../data/ServerData";
import {
  getStoredWorkspaceId,
  setStoredWorkspaceId,
} from "../../data/workspace";
import { navigateTo } from "../../navigation";

import type { Collection, Workspace } from "../../data/api";
import type { ReactNode } from "react";

interface WorkspaceContextValue {
  workspaces: Workspace[];
  /** the workspace the dashboard shows */
  workspace: Workspace;
  collections: Collection[];
  collectionsLoaded: boolean;
  switchWorkspace: (id: string) => void;
  reloadWorkspaces: () => Promise<void>;
  reloadCollections: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [error, setError] = useState("");

  const reloadWorkspaces = useCallback(async () => {
    const res = await api.listWorkspaces();
    const stored = getStoredWorkspaceId();
    const id = res.workspaces.some((w) => w.id === stored)
      ? stored!
      : res.workspaces[0].id;
    setStoredWorkspaceId(id);
    setWorkspaces(res.workspaces);
    setCurrentId(id);
  }, []);

  useEffect(() => {
    // Coming back from the editor: send its last edits before listing anything
    serverData
      .endScene()
      .then(reloadWorkspaces)
      .catch((err) => setError(err.message));
  }, [reloadWorkspaces]);

  const reloadCollections = useCallback(async () => {
    if (currentId) {
      const res = await api.listCollections(currentId);
      setCollections(res.collections);
    }
  }, [currentId]);

  useEffect(() => {
    setCollections(null);
    reloadCollections().catch((err) => setError(err.message));
  }, [reloadCollections]);

  const switchWorkspace = useCallback((id: string) => {
    setStoredWorkspaceId(id);
    setCurrentId(id);
    navigateTo("/");
  }, []);

  const workspace = workspaces?.find((w) => w.id === currentId);
  if (!workspace) {
    return (
      <div className="dashboard-root flex min-h-screen items-center justify-center text-sm text-gray-500">
        {error || "Loading..."}
      </div>
    );
  }

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces: workspaces!,
        workspace,
        collections: collections ?? [],
        collectionsLoaded: collections !== null,
        switchWorkspace,
        reloadWorkspaces,
        reloadCollections,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
