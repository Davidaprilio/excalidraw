import { useEffect, useState } from "react";

import api from "../data/api";
import { ensureSceneThumbnail } from "../data/thumbnails";

import { DashboardIcon, MoreIcon } from "./dashboard/icons";
import { DropdownMenu, timeAgo } from "./dashboard/ui";

import type { MenuItem } from "./dashboard/ui";
import type { SceneSummary } from "../data/api";

/** Object URL of the scene's thumbnail, generating it first if missing or stale. */
export function useSceneThumbnail(scene: SceneSummary): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const { id, version, thumbnail_version, has_content, deleted_at } = scene;

  useEffect(() => {
    if (!has_content) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      let thumbnailVersion = thumbnail_version;
      // trashed scenes can't be loaded for rendering; show whatever exists
      if (
        !deleted_at &&
        (thumbnailVersion === null || thumbnailVersion < version)
      ) {
        // keep showing an older thumbnail if regenerating fails
        thumbnailVersion = await ensureSceneThumbnail(id, version).catch(
          (err) => {
            console.warn("Thumbnail generation failed:", err);
            return thumbnail_version;
          },
        );
      }
      if (thumbnailVersion === null || cancelled) {
        return;
      }
      const blob = await api.getSceneThumbnail(id);
      if (blob && !cancelled) {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [id, version, thumbnail_version, has_content, deleted_at]);

  return url;
}

export function SceneCard({
  scene,
  menuItems,
  onOpen,
  renaming,
  onRename,
  onRenameCancel,
}: {
  scene: SceneSummary;
  menuItems: MenuItem[];
  /** not set for scenes that can't be opened (trash) */
  onOpen?: () => void;
  renaming: boolean;
  onRename: (title: string) => void;
  onRenameCancel: () => void;
}) {
  const thumbnailUrl = useSceneThumbnail(scene);
  const [title, setTitle] = useState(scene.title);

  useEffect(() => {
    setTitle(scene.title);
  }, [scene.title, renaming]);

  const submitRename = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== scene.title) {
      onRename(trimmed);
    } else {
      onRenameCancel();
    }
  };

  const timestamp = scene.deleted_at ?? scene.updated_at;

  return (
    <div className="group flex flex-col">
      {/* The menu is a sibling of the clickable area: no button inside a button,
          and not clipped by the thumbnail's overflow-hidden */}
      <div className="relative">
        <div
          role={onOpen ? "button" : undefined}
          tabIndex={onOpen ? 0 : undefined}
          aria-label={onOpen ? `Open ${scene.title}` : undefined}
          onClick={onOpen}
          onKeyDown={(event) => event.key === "Enter" && onOpen?.()}
          className={`relative h-44 overflow-hidden rounded-xl border border-gray-200 transition ${
            onOpen
              ? "cursor-pointer hover:border-indigo-200 hover:shadow-lg"
              : ""
          } ${
            thumbnailUrl
              ? "bg-white"
              : "bg-gradient-to-br from-indigo-50 via-violet-50 to-pink-50"
          }`}
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              draggable={false}
              className="h-full w-full object-contain p-2"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-indigo-200">
              <DashboardIcon className="h-12 w-12" />
            </div>
          )}
          <span className="absolute right-2 bottom-2 rounded bg-white/90 px-1.5 py-0.5 text-[11px] text-gray-500">
            {timeAgo(timestamp)}
          </span>
        </div>

        <div className="absolute top-2 right-2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100">
          <DropdownMenu
            label="Scene actions"
            triggerClassName="flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-gray-500 shadow-sm hover:text-gray-900"
            trigger={<MoreIcon />}
            items={menuItems}
          />
        </div>
      </div>

      <div className="px-1 pt-2.5">
        {renaming ? (
          <input
            autoFocus
            value={title}
            maxLength={255}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={submitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                submitRename();
              } else if (event.key === "Escape") {
                onRenameCancel();
              }
            }}
            className="w-full rounded-md border border-indigo-400 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
          />
        ) : (
          <p className="truncate text-sm font-medium text-gray-900">
            {scene.title}
          </p>
        )}
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {scene.deleted_at
            ? `Deleted by ${scene.deleted_by_name ?? "unknown"}`
            : `by ${scene.owner_name}`}
          {scene.is_shared && !scene.deleted_at && " · Shared link"}
        </p>
      </div>
    </div>
  );
}
