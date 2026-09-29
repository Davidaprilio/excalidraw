import { navigateTo } from "../../../navigation";
import { FolderIcon, LockIcon, PencilIcon, SettingsIcon } from "../icons";
import { SceneGrid } from "../SceneGrid";
import { Button, EmptyState, ErrorBanner, PageHeader } from "../ui";
import { useCollection } from "../useCollection";
import { useScenes } from "../useScenes";

import { StartDrawingButton } from "./HomePage";

export function CollectionPage({ collectionId }: { collectionId: string }) {
  const {
    collection,
    workspace,
    guest,
    loaded: collectionsLoaded,
  } = useCollection(collectionId);
  const { scenes, error, reload } = useScenes({
    workspaceId: workspace.id,
    collectionId,
  });

  if (!collection) {
    return !collectionsLoaded ? null : (
      <EmptyState
        icon={<FolderIcon className="h-5 w-5" />}
        title="Collection not found"
        description="It may have been deleted, or it belongs to another workspace."
      />
    );
  }

  const isPrivate = collection.visibility === "private";
  const canManage = !collection.is_personal && collection.my_role === "manage";

  return (
    <>
      <PageHeader
        icon={
          isPrivate ? (
            <LockIcon className="h-6 w-6" />
          ) : (
            <FolderIcon className="h-6 w-6" />
          )
        }
        title={collection.name}
        subtitle={`${
          collection.is_personal
            ? "Your private scenes. Only you can see them."
            : isPrivate
            ? "Private: only the people added to it can see it."
            : guest
            ? `Shared with you from ${workspace.name}.`
            : `Shared with everyone in ${workspace.name}.`
        }${collection.my_role === "view" ? " You can view its scenes." : ""}`}
        actions={
          <div className="flex gap-2">
            {canManage && (
              <Button
                onClick={() =>
                  navigateTo(`/collections/${collection.id}/settings`)
                }
              >
                <SettingsIcon /> Settings
              </Button>
            )}
            {collection.my_role !== "view" && (
              <StartDrawingButton collectionId={collection.id} />
            )}
          </div>
        }
      />
      <ErrorBanner message={error} />
      {scenes === null ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : scenes.length ? (
        <SceneGrid scenes={scenes} onChanged={reload} />
      ) : (
        <EmptyState
          icon={<PencilIcon className="h-5 w-5" />}
          title="This collection is empty"
          description="Create a scene here, or move existing scenes in from their menu."
          action={
            collection.my_role !== "view" ? (
              <StartDrawingButton collectionId={collection.id} />
            ) : undefined
          }
        />
      )}
    </>
  );
}
