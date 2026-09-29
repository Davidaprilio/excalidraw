import { useCallback, useEffect, useState } from "react";

import api from "../../../data/api";
import { navigateTo } from "../../../navigation";
import { FolderIcon, ShareIcon } from "../icons";
import { SceneGrid } from "../SceneGrid";
import { EmptyState, ErrorBanner, PageHeader, Section } from "../ui";

import type { CollectionInfo, SceneSummary } from "../../../data/api";

const ROLE_LABELS = {
  view: "Can view",
  edit: "Can edit",
  manage: "Can manage",
};

/** /shared: collections and scenes shared with me from other workspaces */
export function SharedWithMePage() {
  const [collections, setCollections] = useState<CollectionInfo[] | null>(null);
  const [scenes, setScenes] = useState<SceneSummary[]>([]);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const res = await api.sharedWithMe();
      setCollections(res.collections);
      setScenes(res.scenes);
      setError("");
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <>
      <PageHeader
        icon={<ShareIcon className="h-6 w-6" />}
        title="Shared with me"
        subtitle="Collections and scenes people from other workspaces shared with you."
      />
      <ErrorBanner message={error} />
      {collections === null ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : !collections.length && !scenes.length ? (
        <EmptyState
          icon={<ShareIcon className="h-5 w-5" />}
          title="Nothing shared with you yet"
          description="When someone from another workspace adds you (or your team) to a collection or a scene, it shows up here."
        />
      ) : (
        <>
          {collections.length > 0 && (
            <Section title="Collections">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
                {collections.map((collection) => {
                  const href = `/collections/${collection.id}`;
                  return (
                    <a
                      key={collection.id}
                      href={href}
                      onClick={(event) => {
                        event.preventDefault();
                        navigateTo(href);
                      }}
                      className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-indigo-200 hover:shadow-md"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <FolderIcon />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">
                          {collection.name}
                        </span>
                        <span className="block truncate text-xs text-gray-500">
                          From {collection.workspace_name} ·{" "}
                          {collection.scene_count} scene
                          {collection.scene_count === 1 ? "" : "s"}
                        </span>
                        {collection.my_role && (
                          <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            {ROLE_LABELS[collection.my_role]}
                          </span>
                        )}
                      </span>
                    </a>
                  );
                })}
              </div>
            </Section>
          )}
          {scenes.length > 0 && (
            <Section title="Scenes">
              <SceneGrid scenes={scenes} onChanged={reload} />
            </Section>
          )}
        </>
      )}
    </>
  );
}
