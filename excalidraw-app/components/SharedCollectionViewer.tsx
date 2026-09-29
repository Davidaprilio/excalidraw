import { useEffect, useState } from "react";

import api from "../data/api";
import { navigateTo } from "../navigation";

import { DashboardIcon, FolderIcon } from "./dashboard/icons";
import { timeAgo } from "./dashboard/ui";
import { SharedSceneViewer } from "./SharedSceneViewer";

import type { SharedCollection } from "../data/api";

/**
 * Public read-only collection link: /share/c/:token lists its scenes,
 * /share/c/:token/:sceneId opens one in the read-only viewer.
 */
export function SharedCollectionViewer({
  token,
  sceneId,
}: {
  token: string;
  sceneId?: string;
}) {
  const listHref = `/share/c/${token}`;
  const [data, setData] = useState<SharedCollection | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getSharedCollection(token)
      .then((res) => !cancelled && setData(res))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (data && !sceneId) {
      document.title = `${data.collection.name} - Excalidraw`;
    }
  }, [data, sceneId]);

  if (sceneId) {
    return (
      <SharedSceneViewer
        key={sceneId}
        token={`${token}/${sceneId}`}
        load={() => api.getSharedCollectionScene(token, sceneId)}
        back={{ label: "Back to collection", href: listHref }}
      />
    );
  }

  if (error || !data) {
    return (
      <div className="dashboard-root flex min-h-screen items-center justify-center bg-white text-sm text-gray-600">
        {error
          ? "This link is invalid or sharing has been turned off."
          : "Loading..."}
      </div>
    );
  }

  return (
    <div className="dashboard-root min-h-screen bg-white text-gray-900">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8 flex items-center gap-3 border-b border-gray-200 pb-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <FolderIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">
              {data.collection.name}
            </h1>
            <p className="text-sm text-gray-500">
              {data.collection.workspace_name} · {data.scenes.length} scene
              {data.scenes.length === 1 ? "" : "s"} · read only
            </p>
          </div>
        </header>

        {data.scenes.length === 0 ? (
          <p className="text-sm text-gray-500">
            This collection has no scenes yet.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-6">
            {data.scenes.map((scene) => {
              const href = `${listHref}/${scene.id}`;
              return (
                <a
                  key={scene.id}
                  href={href}
                  onClick={(event) => {
                    event.preventDefault();
                    navigateTo(href);
                  }}
                  className="group flex flex-col"
                >
                  <SharedThumbnail
                    src={
                      scene.has_thumbnail
                        ? api.sharedCollectionThumbnailUrl(token, scene.id)
                        : null
                    }
                    updatedAt={scene.updated_at}
                  />
                  <span className="truncate px-1 pt-2.5 text-sm font-medium text-gray-900">
                    {scene.title}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function SharedThumbnail({
  src,
  updatedAt,
}: {
  src: string | null;
  updatedAt: string;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <span
      className={`relative block h-44 overflow-hidden rounded-xl border border-gray-200 transition group-hover:border-indigo-200 group-hover:shadow-lg ${
        src && !broken
          ? "bg-white"
          : "bg-gradient-to-br from-indigo-50 via-violet-50 to-pink-50"
      }`}
    >
      {src && !broken ? (
        <img
          src={src}
          alt=""
          draggable={false}
          onError={() => setBroken(true)}
          className="h-full w-full object-contain p-2"
        />
      ) : (
        <span className="flex h-full items-center justify-center text-indigo-200">
          <DashboardIcon className="h-12 w-12" />
        </span>
      )}
      <span className="absolute right-2 bottom-2 rounded bg-white/90 px-1.5 py-0.5 text-[11px] text-gray-500">
        {timeAgo(updatedAt)}
      </span>
    </span>
  );
}
