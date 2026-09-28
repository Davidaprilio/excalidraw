import { useEffect, useRef, useState } from "react";

import api from "../../data/api";
import { navigateTo } from "../../navigation";

import { DashboardIcon, FolderIcon, LockIcon, SearchIcon } from "./icons";
import { timeAgo, useDismiss } from "./ui";
import { useWorkspace } from "./WorkspaceContext";

import type { SceneSummary } from "../../data/api";

type Result =
  | { kind: "scene"; scene: SceneSummary }
  | { kind: "collection"; id: string; name: string; isPrivate: boolean };

/** Ctrl+P palette: scenes and collections of the current workspace. */
export function QuickSearch({ onClose }: { onClose: () => void }) {
  const { workspace, collections } = useWorkspace();
  const [query, setQuery] = useState("");
  const [scenes, setScenes] = useState<SceneSummary[]>([]);
  const [selected, setSelected] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  useDismiss(panelRef, onClose);

  useEffect(() => {
    let cancelled = false;
    const q = query.trim();
    // Empty query: recently visited scenes
    const timer = setTimeout(
      () => {
        api
          .listScenes({
            workspaceId: workspace.id,
            view: q ? "all" : "visited",
            q,
            limit: 8,
          })
          .then((res) => !cancelled && setScenes(res.scenes))
          .catch(() => {});
      },
      q ? 150 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, workspace.id]);

  const q = query.trim().toLowerCase();
  const results: Result[] = [
    ...scenes.map((scene) => ({ kind: "scene" as const, scene })),
    ...(q
      ? collections
          .filter((c) => c.name.toLowerCase().includes(q))
          .map((c) => ({
            kind: "collection" as const,
            id: c.id,
            name: c.name,
            isPrivate: c.visibility === "private",
          }))
      : []),
  ];

  useEffect(() => setSelected(0), [query, scenes.length]);

  const open = (result: Result) => {
    onClose();
    navigateTo(
      result.kind === "scene"
        ? `/s/${result.scene.id}`
        : `/collections/${result.id}`,
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-gray-900/30 px-4 pt-[12vh]">
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Quick search"
        className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-gray-200 px-4">
          <SearchIcon className="h-5 w-5 text-gray-400" />
          <input
            autoFocus
            value={query}
            placeholder="Search scenes and collections..."
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelected((i) => Math.min(i + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelected((i) => Math.max(i - 1, 0));
              } else if (event.key === "Enter" && results[selected]) {
                open(results[selected]);
              }
            }}
            className="flex-1 py-4 text-base outline-none"
          />
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {!q && scenes.length > 0 && (
            <p className="px-3 pt-1 pb-2 text-xs font-medium text-gray-400">
              Recently visited
            </p>
          )}
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-gray-500">
              {q ? "No results" : "Type to search"}
            </p>
          )}
          {results.map((result, index) => (
            <button
              key={result.kind === "scene" ? result.scene.id : result.id}
              type="button"
              onMouseEnter={() => setSelected(index)}
              onClick={() => open(result)}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${
                index === selected ? "bg-indigo-50" : ""
              }`}
            >
              <span className="text-gray-400">
                {result.kind === "scene" ? (
                  <DashboardIcon />
                ) : result.isPrivate ? (
                  <LockIcon />
                ) : (
                  <FolderIcon />
                )}
              </span>
              <span className="flex-1 truncate text-gray-900">
                {result.kind === "scene" ? result.scene.title : result.name}
              </span>
              <span className="text-xs text-gray-400">
                {result.kind === "scene"
                  ? `${result.scene.collection_name ?? ""} · ${timeAgo(
                      result.scene.updated_at,
                    )}`
                  : "Collection"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
