import { useCallback, useEffect, useState } from "react";

import api from "../../data/api";

import { useWorkspace } from "./WorkspaceContext";

import type { PanelWorkspace } from "./CollectionAccessPanel";
import type { Collection, CollectionInfo } from "../../data/api";

/**
 * A collection by id: from the current workspace, or loaded on its own when it
 * lives elsewhere (e.g. shared with me from another workspace, as a guest).
 */
export function useCollection(collectionId: string): {
  collection: Collection | null;
  /** the collection's workspace */
  workspace: PanelWorkspace;
  /** I'm not a member of its workspace */
  guest: boolean;
  loaded: boolean;
  reload: () => Promise<void>;
} {
  const { workspace, collections, collectionsLoaded, reloadCollections } =
    useWorkspace();
  const local = collections.find((c) => c.id === collectionId) ?? null;
  const [remote, setRemote] = useState<CollectionInfo | null>(null);
  const [remoteLoaded, setRemoteLoaded] = useState(false);

  const reloadRemote = useCallback(async () => {
    try {
      setRemote((await api.getCollection(collectionId)).collection);
    } catch {
      setRemote(null);
    } finally {
      setRemoteLoaded(true);
    }
  }, [collectionId]);

  useEffect(() => {
    if (collectionsLoaded && !local) {
      reloadRemote();
    }
  }, [collectionsLoaded, local, reloadRemote]);

  if (local || !collectionsLoaded) {
    return {
      collection: local,
      workspace,
      guest: false,
      loaded: collectionsLoaded,
      reload: reloadCollections,
    };
  }
  return {
    collection: remote,
    workspace: remote
      ? {
          id: remote.workspace_id,
          name: remote.workspace_name,
          avatar_version: remote.workspace_avatar_version,
          member_count: remote.workspace_member_count,
        }
      : workspace,
    guest: !!remote && !remote.in_workspace,
    loaded: remoteLoaded,
    reload: reloadRemote,
  };
}
