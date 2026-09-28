import { FolderIcon, LockIcon, PencilIcon } from "../icons";
import { SceneGrid } from "../SceneGrid";
import { EmptyState, ErrorBanner, PageHeader } from "../ui";
import { useScenes } from "../useScenes";
import { useWorkspace } from "../WorkspaceContext";

import { StartDrawingButton } from "./HomePage";

export function CollectionPage({ collectionId }: { collectionId: string }) {
  const { workspace, collections, collectionsLoaded } = useWorkspace();
  const collection = collections.find((c) => c.id === collectionId);
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
        subtitle={
          collection.is_personal
            ? "Your private scenes. Only you can see them."
            : isPrivate
            ? "Only you can see this collection."
            : `Shared with everyone in ${workspace.name}.`
        }
        actions={<StartDrawingButton collectionId={collection.id} />}
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
          action={<StartDrawingButton collectionId={collection.id} />}
        />
      )}
    </>
  );
}
