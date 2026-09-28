import { useCallback, useEffect, useState } from "react";

import api from "../../../data/api";
import { RestoreIcon, TrashIcon } from "../icons";
import { SceneGrid } from "../SceneGrid";
import {
  Avatar,
  Button,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Section,
  timeAgo,
  useToast,
} from "../ui";
import { useScenes } from "../useScenes";
import { useWorkspace } from "../WorkspaceContext";

import type { DeletedWorkspace } from "../../../data/api";

export function TrashPage() {
  const { workspace } = useWorkspace();
  const toast = useToast();
  const { scenes, error, reload } = useScenes({
    workspaceId: workspace.id,
    view: "trash",
  });
  const deletable = scenes?.filter((s) => s.can_delete_permanently) ?? [];
  // Deleted workspaces live in their owner's personal trash
  const showWorkspaces = workspace.is_personal && workspace.is_owner;

  const emptyTrash = async () => {
    if (
      !window.confirm(
        `Delete ${deletable.length} scene(s) forever? This can't be undone.`,
      )
    ) {
      return;
    }
    const results = await Promise.allSettled(
      deletable.map((s) => api.deleteScenePermanently(s.id)),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    toast(failed ? `${failed} scene(s) couldn't be deleted` : "Trash emptied");
    reload();
  };

  return (
    <>
      <PageHeader
        icon={<TrashIcon className="h-6 w-6" />}
        title="Trash"
        subtitle="Deleted scenes can be restored. Only a scene's owner or a workspace admin can delete it forever."
        actions={
          deletable.length > 0 && (
            <Button variant="danger" onClick={emptyTrash}>
              Empty trash
            </Button>
          )
        }
      />
      <ErrorBanner message={error} />
      {showWorkspaces && <DeletedWorkspaces />}
      <Section title="Scenes">
        {scenes === null ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : scenes.length ? (
          <SceneGrid scenes={scenes} mode="trash" onChanged={reload} />
        ) : (
          <EmptyState
            icon={<TrashIcon className="h-5 w-5" />}
            title="No deleted scenes"
          />
        )}
      </Section>
    </>
  );
}

function DeletedWorkspaces() {
  const { reloadWorkspaces } = useWorkspace();
  const toast = useToast();
  const [workspaces, setWorkspaces] = useState<DeletedWorkspace[]>([]);

  const reload = useCallback(
    () =>
      api
        .listDeletedWorkspaces()
        .then((res) => setWorkspaces(res.workspaces))
        .catch((err) => toast(err.message)),
    [toast],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  if (!workspaces.length) {
    return null;
  }

  const run = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      toast(message);
      await reload();
      await reloadWorkspaces();
    } catch (err: any) {
      toast(err.message);
    }
  };

  return (
    <Section title="Deleted workspaces">
      <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
        {workspaces.map((w) => (
          <div key={w.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={w.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
                {w.name}
              </p>
              <p className="text-xs text-gray-500">
                {w.scene_count} scene{w.scene_count === 1 ? "" : "s"} · deleted{" "}
                {timeAgo(w.deleted_at)}
                {w.deleted_by_name && ` by ${w.deleted_by_name}`}
              </p>
            </div>
            <Button
              onClick={() =>
                run(() => api.restoreWorkspace(w.id), `${w.name} restored`)
              }
            >
              <RestoreIcon />
              Restore
            </Button>
            <Button
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete "${w.name}" and its ${w.scene_count} scene(s) forever? This can't be undone.`,
                  )
                ) {
                  run(
                    () => api.deleteWorkspacePermanently(w.id),
                    `${w.name} deleted forever`,
                  );
                }
              }}
            >
              Delete forever
            </Button>
          </div>
        ))}
      </div>
    </Section>
  );
}
