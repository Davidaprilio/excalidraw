import { useEffect, useState } from "react";

import api from "../../data/api";
import { useAuth } from "../../auth/AuthContext";
import { navigateTo } from "../../navigation";
import { SceneCard } from "../SceneCard";

import {
  CopyIcon,
  FolderIcon,
  LinkIcon,
  LockIcon,
  PencilIcon,
  RestoreIcon,
  TrashIcon,
} from "./icons";
import { Button, Modal, useToast } from "./ui";
import { useWorkspace } from "./WorkspaceContext";

import type { MenuItem } from "./ui";
import type { Collection, SceneSummary, Workspace } from "../../data/api";

/** Grid of scene cards with all per-scene actions. Calls `onChanged` after any change. */
export function SceneGrid({
  scenes,
  mode = "normal",
  onChanged,
}: {
  scenes: SceneSummary[];
  mode?: "normal" | "trash";
  onChanged: () => void;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const { workspace, workspaces, reloadCollections, reloadWorkspaces } =
    useWorkspace();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [moving, setMoving] = useState<SceneSummary | null>(null);
  const [transferring, setTransferring] = useState<SceneSummary | null>(null);
  // Moving to another workspace: the scene's owner or a workspace admin
  const canTransfer = (scene: SceneSummary) =>
    workspaces.length > 1 &&
    (scene.owner_id === user?.id || workspace.role === "admin");

  const run = async (action: () => Promise<unknown>, message?: string) => {
    try {
      await action();
      if (message) {
        toast(message);
      }
      onChanged();
      reloadCollections().catch(() => {});
    } catch (err: any) {
      toast(err.message);
    }
  };

  const copyShareLink = async (scene: SceneSummary) => {
    const res = await api.shareScene(scene.id);
    await navigator.clipboard
      .writeText(`${window.location.origin}/share/${res.scene.share_token}`)
      .catch(() => {});
  };

  const menuFor = (scene: SceneSummary): MenuItem[] =>
    mode === "trash"
      ? [
          {
            label: "Restore",
            icon: <RestoreIcon />,
            onSelect: () =>
              run(() => api.restoreSceneFromTrash(scene.id), "Scene restored"),
          },
          ...(scene.can_delete_permanently
            ? [
                {
                  label: "Delete forever",
                  icon: <TrashIcon />,
                  danger: true,
                  onSelect: () => {
                    if (
                      window.confirm(
                        `Delete "${scene.title}" forever? This can't be undone.`,
                      )
                    ) {
                      run(
                        () => api.deleteScenePermanently(scene.id),
                        "Scene deleted forever",
                      );
                    }
                  },
                },
              ]
            : []),
        ]
      : [
          {
            label: "Rename",
            icon: <PencilIcon />,
            onSelect: () => setRenamingId(scene.id),
          },
          {
            label: scene.is_shared ? "Copy share link" : "Share read-only link",
            icon: <LinkIcon />,
            onSelect: () =>
              run(
                () => copyShareLink(scene),
                "Read-only link copied to clipboard",
              ),
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
          {
            label: "Duplicate",
            icon: <CopyIcon />,
            onSelect: () =>
              run(() => api.duplicateScene(scene.id), "Scene duplicated"),
          },
          {
            label: "Move to collection...",
            icon: <FolderIcon />,
            onSelect: () => setMoving(scene),
          },
          ...(canTransfer(scene)
            ? [
                {
                  label: "Move to workspace...",
                  icon: <FolderIcon />,
                  onSelect: () => setTransferring(scene),
                },
              ]
            : []),
          "separator",
          {
            label: "Move to trash",
            icon: <TrashIcon />,
            danger: true,
            onSelect: () =>
              run(() => api.deleteScene(scene.id), "Moved to trash"),
          },
        ];

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-x-5 gap-y-6">
        {scenes.map((scene) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            menuItems={menuFor(scene)}
            onOpen={
              mode === "trash" ? undefined : () => navigateTo(`/s/${scene.id}`)
            }
            renaming={renamingId === scene.id}
            onRename={(title) => {
              setRenamingId(null);
              run(() => api.renameScene(scene.id, title));
            }}
            onRenameCancel={() => setRenamingId(null)}
          />
        ))}
      </div>
      {moving && (
        <MoveDialog
          scene={moving}
          onClose={() => setMoving(null)}
          onMove={(collectionId, collectionName) =>
            run(
              () => api.moveScene(moving.id, collectionId),
              `Moved to ${collectionName}`,
            )
          }
        />
      )}
      {transferring && (
        <TransferDialog
          scene={transferring}
          workspaces={workspaces.filter((w) => w.id !== workspace.id)}
          onClose={() => setTransferring(null)}
          onTransfer={(target, collectionId) =>
            run(async () => {
              await api.transferScene(transferring.id, target.id, collectionId);
              await reloadWorkspaces();
            }, `Moved to ${target.name}`)
          }
        />
      )}
    </>
  );
}

/** Pick a target workspace, then one of its collections (default: your Private). */
function TransferDialog({
  scene,
  workspaces,
  onClose,
  onTransfer,
}: {
  scene: SceneSummary;
  workspaces: Workspace[];
  onClose: () => void;
  onTransfer: (workspace: Workspace, collectionId: string) => void;
}) {
  const [target, setTarget] = useState<Workspace>(workspaces[0]);
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [collectionId, setCollectionId] = useState("");

  useEffect(() => {
    let cancelled = false;
    setCollections(null);
    api.listCollections(target.id).then((res) => {
      if (!cancelled) {
        setCollections(res.collections);
        setCollectionId(res.collections[0]?.id ?? "");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [target.id]);

  return (
    <Modal
      title={`Move "${scene.title}" to another workspace`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4 text-sm">
        <label className="flex flex-col gap-1.5 font-medium text-gray-700">
          Workspace
          <select
            value={target.id}
            onChange={(event) =>
              setTarget(workspaces.find((w) => w.id === event.target.value)!)
            }
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.is_personal && w.is_owner ? " (personal)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 font-medium text-gray-700">
          Collection
          <select
            value={collectionId}
            disabled={!collections}
            onChange={(event) => setCollectionId(event.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal"
          >
            {collections?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.visibility === "private" ? " (only you)" : ""}
              </option>
            ))}
          </select>
        </label>
        <p className="text-gray-500">
          You become the owner of the scene. People who aren't members of{" "}
          {target.name} lose access to it.
        </p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!collectionId}
          onClick={() => {
            onClose();
            onTransfer(target, collectionId);
          }}
        >
          Move
        </Button>
      </div>
    </Modal>
  );
}

function MoveDialog({
  scene,
  onClose,
  onMove,
}: {
  scene: SceneSummary;
  onClose: () => void;
  onMove: (collectionId: string, collectionName: string) => void;
}) {
  const { collections } = useWorkspace();
  return (
    <Modal title={`Move "${scene.title}"`} onClose={onClose}>
      <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
        {collections.map((collection) => {
          const current = collection.id === scene.collection_id;
          return (
            <button
              key={collection.id}
              type="button"
              disabled={current}
              onClick={() => {
                onClose();
                onMove(collection.id, collection.name);
              }}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-default disabled:bg-indigo-50 disabled:text-indigo-700"
            >
              {collection.visibility === "private" ? (
                <LockIcon />
              ) : (
                <FolderIcon />
              )}
              <span className="flex-1 truncate">{collection.name}</span>
              {current && <span className="text-xs">Current</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
