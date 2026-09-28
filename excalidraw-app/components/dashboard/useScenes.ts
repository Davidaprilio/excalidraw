import { useCallback, useEffect, useState } from "react";

import api from "../../data/api";

import type { SceneListView, SceneSummary } from "../../data/api";

export function useScenes(params: {
  workspaceId: string;
  collectionId?: string;
  view?: SceneListView;
  limit?: number;
}) {
  const { workspaceId, collectionId, view, limit } = params;
  const [scenes, setScenes] = useState<SceneSummary[] | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const res = await api.listScenes({
        workspaceId,
        collectionId,
        view,
        limit,
      });
      setScenes(res.scenes);
      setError("");
    } catch (err: any) {
      setError(err.message);
    }
  }, [workspaceId, collectionId, view, limit]);

  useEffect(() => {
    setScenes(null);
    reload();
  }, [reload]);

  return { scenes, error, reload };
}
