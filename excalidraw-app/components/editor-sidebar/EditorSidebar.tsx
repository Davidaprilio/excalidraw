import { useCallback, useEffect, useState } from "react";

import api from "../../data/api";
import { exportServerScene } from "../../data/exportScene";
import { serverData } from "../../data/ServerData";
import {
  getStoredWorkspaceId,
  setStoredWorkspaceId,
} from "../../data/workspace";
import { navigateTo } from "../../navigation";
import {
  ChevronLeftIcon,
  ChevronsUpDownIcon,
  CopyIcon,
  DashboardIcon,
  FolderIcon,
  ImageIcon,
  LinkIcon,
  LockIcon,
  MoreIcon,
  MoveIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  ShareIcon,
  SortIcon,
  TrashIcon,
} from "../dashboard/icons";
import { Avatar, timeAgo } from "../dashboard/ui";
import { useSceneThumbnail } from "../SceneCard";

import { SidebarMenu } from "./SidebarMenu";

import "./EditorSidebar.scss";

import type { SidebarMenuItem } from "./SidebarMenu";
import type { Collection, SceneSummary, Workspace } from "../../data/api";

type View = { kind: "collections" } | { kind: "collection"; id: string };
type Sort = "recent" | "name";

/**
 * Left sidebar inside the editor (like Excalidraw+): workspace switcher, quick
 * search, and the scenes of a collection with per-scene actions.
 */
export function EditorSidebar({
  theme,
  onToast,
}: {
  theme: "light" | "dark";
  onToast: (message: string) => void;
}) {
  const [openScene, setOpenScene] = useState(serverData.getSceneInfo());
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(
    openScene?.workspaceId ?? getStoredWorkspaceId(),
  );
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [scenes, setScenes] = useState<SceneSummary[] | null>(null);
  const [sort, setSort] = useState<Sort>("recent");
  const [query, setQuery] = useState<string | null>(null);
  const [results, setResults] = useState<SceneSummary[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  // Follow the open scene: opened, created on first save, renamed
  useEffect(
    () =>
      serverData.subscribe(() => {
        setOpenScene(serverData.getSceneInfo());
        reload();
      }),
    [reload],
  );
  useEffect(() => {
    if (openScene?.workspaceId) {
      setWorkspaceId(openScene.workspaceId);
    }
  }, [openScene?.workspaceId]);

  useEffect(() => {
    api
      .listWorkspaces()
      .then((res) => {
        setWorkspaces(res.workspaces);
        setWorkspaceId((id) =>
          res.workspaces.some((w) => w.id === id) ? id : res.workspaces[0].id,
        );
      })
      .catch((err) => onToast(err.message));
  }, [onToast]);

  const workspace = workspaces.find((w) => w.id === workspaceId);

  // Collections of the workspace; start in the open scene's collection (or Private)
  useEffect(() => {
    if (!workspaceId) {
      return;
    }
    let cancelled = false;
    api
      .listCollections(workspaceId)
      .then((res) => {
        if (cancelled) {
          return;
        }
        setCollections(res.collections);
        setView((current) => {
          if (
            current?.kind === "collection" &&
            res.collections.some((c) => c.id === current.id)
          ) {
            return current;
          }
          if (current?.kind === "collections") {
            return current;
          }
          const initial =
            res.collections.find((c) => c.id === openScene?.collectionId) ??
            res.collections.find((c) => c.is_personal) ??
            res.collections[0];
          return initial
            ? { kind: "collection", id: initial.id }
            : { kind: "collections" };
        });
      })
      .catch((err) => onToast(err.message));
    return () => {
      cancelled = true;
    };
  }, [workspaceId, reloadKey, openScene?.collectionId, onToast]);

  const collectionId = view?.kind === "collection" ? view.id : null;
  const collection = collections?.find((c) => c.id === collectionId);

  // Don't show the previous collection's scenes under the new header
  useEffect(() => setScenes(null), [workspaceId, collectionId]);

  useEffect(() => {
    if (!workspaceId || !collectionId) {
      return;
    }
    let cancelled = false;
    api
      .listScenes({ workspaceId, collectionId })
      .then((res) => !cancelled && setScenes(res.scenes))
      .catch((err) => onToast(err.message));
    return () => {
      cancelled = true;
    };
  }, [workspaceId, collectionId, reloadKey, onToast]);

  useEffect(() => {
    const q = query?.trim();
    if (!q || !workspaceId) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .listScenes({ workspaceId, q, limit: 30 })
        .then((res) => !cancelled && setResults(res.scenes))
        .catch(() => {});
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, workspaceId, reloadKey]);

  // Ctrl+P focuses the search, like on the dashboard
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setQuery((q) => q ?? "");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const switchWorkspace = (id: string) => {
    setStoredWorkspaceId(id);
    setWorkspaceId(id);
    setCollections(null);
    setScenes(null);
    setView(null);
  };

  const sorted = [...(scenes ?? [])].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      (sort === "name"
        ? a.title.localeCompare(b.title)
        : b.updated_at.localeCompare(a.updated_at)),
  );

  return (
    <aside
      className={`app-editor-sidebar${theme === "dark" ? " theme--dark" : ""}`}
      aria-label="Scenes sidebar"
    >
      <div className="app-editor-sidebar__top">
        <SidebarMenu
          label="Switch workspace"
          triggerClassName="app-editor-sidebar__workspace"
          trigger={
            <>
              <Avatar name={workspace?.name ?? "?"} size="h-9 w-9 text-base" />
              <span className="app-editor-sidebar__workspace-name">
                {workspace?.name ?? "Loading..."}
              </span>
              <ChevronsUpDownIcon />
            </>
          }
          items={workspaces.map((w) => ({
            label:
              w.is_personal && w.is_owner ? `${w.name} (personal)` : w.name,
            checked: w.id === workspaceId,
            onSelect: () => switchWorkspace(w.id),
          }))}
        />

        {query === null ? (
          <button
            type="button"
            className="app-editor-sidebar__search"
            onClick={() => setQuery("")}
          >
            <SearchIcon />
            <span>Quick search</span>
            <kbd>Ctrl+P</kbd>
          </button>
        ) : (
          <label className="app-editor-sidebar__search is-active">
            <SearchIcon />
            <input
              autoFocus
              value={query}
              placeholder="Search scenes..."
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Escape") {
                  setQuery(null);
                }
              }}
              onBlur={() => !query.trim() && setQuery(null)}
            />
          </label>
        )}

        <button
          type="button"
          className="app-editor-sidebar__nav"
          onClick={() => navigateTo("/")}
        >
          <DashboardIcon />
          Dashboard
        </button>
      </div>

      {query?.trim() ? (
        <div className="app-editor-sidebar__list">
          <p className="app-editor-sidebar__hint">
            {results.length ? "Results" : "No results"}
          </p>
          {results.map((scene) => (
            <SceneRow
              key={scene.id}
              scene={scene}
              openScene={openScene}
              collections={collections ?? []}
              onChanged={reload}
              onToast={onToast}
            />
          ))}
        </div>
      ) : view?.kind === "collections" ? (
        <>
          <div className="app-editor-sidebar__header">
            <span className="app-editor-sidebar__title">Collections</span>
          </div>
          <div className="app-editor-sidebar__list">
            {collections?.map((c) => (
              <button
                key={c.id}
                type="button"
                className="app-editor-sidebar__collection"
                onClick={() => setView({ kind: "collection", id: c.id })}
              >
                {c.visibility === "private" ? <LockIcon /> : <FolderIcon />}
                <span>{c.name}</span>
                <span className="app-editor-sidebar__count">
                  {c.scene_count}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="app-editor-sidebar__header">
            <button
              type="button"
              aria-label="All collections"
              title="All collections"
              className="app-editor-sidebar__icon-button"
              onClick={() => setView({ kind: "collections" })}
            >
              <ChevronLeftIcon />
            </button>
            {collection?.visibility === "private" ? (
              <LockIcon />
            ) : (
              <FolderIcon />
            )}
            <span className="app-editor-sidebar__title">
              {collection?.name ?? ""}
            </span>
            <button
              type="button"
              aria-label={`Sort by ${
                sort === "recent" ? "name" : "last modified"
              }`}
              title={`Sorted by ${
                sort === "recent" ? "last modified" : "name"
              }`}
              className="app-editor-sidebar__icon-button"
              onClick={() =>
                setSort((s) => (s === "recent" ? "name" : "recent"))
              }
            >
              <SortIcon />
            </button>
            <button
              type="button"
              aria-label="New scene in this collection"
              title="New scene in this collection"
              className="app-editor-sidebar__icon-button is-primary"
              disabled={!collectionId}
              onClick={() => navigateTo(`/s/new?collection=${collectionId}`)}
            >
              <PlusIcon />
            </button>
          </div>
          <div className="app-editor-sidebar__list">
            {scenes === null ? (
              <p className="app-editor-sidebar__hint">Loading...</p>
            ) : sorted.length === 0 ? (
              <p className="app-editor-sidebar__hint">No scenes yet</p>
            ) : (
              sorted.map((scene) => (
                <SceneRow
                  key={scene.id}
                  scene={scene}
                  openScene={openScene}
                  collections={collections ?? []}
                  onChanged={reload}
                  onToast={onToast}
                />
              ))
            )}
          </div>
        </>
      )}
    </aside>
  );
}

const moveTargets = (
  collections: Collection[],
  scene: SceneSummary,
  run: (action: () => Promise<unknown>, message?: string) => void,
): SidebarMenuItem[] => {
  const targets = collections.filter((c) => c.id !== scene.collection_id);
  return targets.length
    ? targets.map((c) => ({
        label: c.name,
        icon: c.visibility === "private" ? <LockIcon /> : <FolderIcon />,
        onSelect: () =>
          run(() => api.moveScene(scene.id, c.id), `Moved to ${c.name}`),
      }))
    : [{ label: "No other collections" }];
};

function SceneRow({
  scene,
  openScene,
  collections,
  onChanged,
  onToast,
}: {
  scene: SceneSummary;
  openScene: ReturnType<typeof serverData.getSceneInfo>;
  collections: Collection[];
  onChanged: () => void;
  onToast: (message: string) => void;
}) {
  const thumbnailUrl = useSceneThumbnail(scene);
  const isOpen = scene.id === openScene?.id;
  const title = isOpen ? openScene!.title : scene.title;
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(title);

  const run = async (action: () => Promise<unknown>, message?: string) => {
    try {
      // include unsaved edits of the open scene (copy, export...)
      if (isOpen) {
        await serverData.flush();
      }
      await action();
      if (message) {
        onToast(message);
      }
      onChanged();
    } catch (err: any) {
      onToast(err.message);
    }
  };

  const rename = () => {
    setRenaming(false);
    const trimmed = value.trim();
    if (!trimmed || trimmed === title) {
      setValue(title);
      return;
    }
    run(() =>
      isOpen ? serverData.rename(trimmed) : api.renameScene(scene.id, trimmed),
    );
  };

  const menu: SidebarMenuItem[] = [
    {
      label: "Rename",
      icon: <PencilIcon />,
      onSelect: () => {
        setValue(title);
        setRenaming(true);
      },
    },
    {
      label: "Share",
      icon: <ShareIcon />,
      submenu: [
        {
          label: scene.is_shared
            ? "Copy read-only link"
            : "Create read-only link",
          icon: <LinkIcon />,
          onSelect: () =>
            run(async () => {
              const res = await api.shareScene(scene.id);
              await navigator.clipboard
                .writeText(
                  `${window.location.origin}/share/${res.scene.share_token}`,
                )
                .catch(() => {});
            }, "Read-only link copied to clipboard"),
        },
        ...(scene.is_shared
          ? [
              {
                label: "Stop sharing link",
                icon: <LockIcon />,
                onSelect: () =>
                  run(
                    () => api.unshareScene(scene.id),
                    "The link no longer works",
                  ),
              },
            ]
          : []),
      ],
    },
    {
      label: "Quick export",
      icon: <ImageIcon />,
      submenu: [
        {
          label: "PNG image",
          icon: <ImageIcon />,
          onSelect: () => run(() => exportServerScene(scene.id, "png")),
        },
        {
          label: "SVG image",
          icon: <ImageIcon />,
          onSelect: () => run(() => exportServerScene(scene.id, "svg")),
        },
      ],
    },
    {
      label: scene.pinned ? "Unpin" : "Pin",
      icon: <PinIcon />,
      onSelect: () =>
        run(
          () => api.setScenePinned(scene.id, !scene.pinned),
          scene.pinned ? "Unpinned" : "Pinned to the top",
        ),
    },
    {
      label: "Duplicate",
      icon: <CopyIcon />,
      onSelect: () =>
        run(() => api.duplicateScene(scene.id), "Scene duplicated"),
    },
    {
      label: "Move",
      icon: <MoveIcon />,
      submenu: moveTargets(collections, scene, run),
    },
    "separator",
    {
      label: "Move to trash",
      icon: <TrashIcon />,
      danger: true,
      onSelect: () =>
        run(async () => {
          await api.deleteScene(scene.id);
          if (isOpen) {
            navigateTo("/");
          }
        }, "Moved to trash"),
    },
  ];

  return (
    <div className={`app-editor-sidebar__scene${isOpen ? " is-open" : ""}`}>
      <button
        type="button"
        className="app-editor-sidebar__scene-main"
        onClick={() => !isOpen && !renaming && navigateTo(`/s/${scene.id}`)}
      >
        <span className="app-editor-sidebar__thumb">
          {thumbnailUrl && <img src={thumbnailUrl} alt="" draggable={false} />}
        </span>
        <span className="app-editor-sidebar__scene-text">
          {renaming ? (
            <input
              autoFocus
              value={value}
              maxLength={255}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setValue(event.target.value)}
              onBlur={rename}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") {
                  rename();
                } else if (event.key === "Escape") {
                  setValue(title);
                  setRenaming(false);
                }
              }}
            />
          ) : (
            <span className="app-editor-sidebar__scene-title">
              {scene.pinned && <PinIcon className="app-editor-sidebar__pin" />}
              {title}
            </span>
          )}
          <span className="app-editor-sidebar__scene-meta">
            by {scene.owner_name}
          </span>
          <span className="app-editor-sidebar__scene-meta">
            {timeAgo(scene.updated_at)}
          </span>
        </span>
      </button>
      <SidebarMenu
        label="Scene actions"
        triggerClassName="app-editor-sidebar__more"
        trigger={<MoreIcon />}
        items={menu}
      />
    </div>
  );
}
