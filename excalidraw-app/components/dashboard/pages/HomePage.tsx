import { navigateTo } from "../../../navigation";
import { DashboardIcon, InfoIcon, PencilIcon } from "../icons";
import { SceneGrid } from "../SceneGrid";
import { Button, EmptyState, ErrorBanner, PageHeader, Section } from "../ui";
import { useScenes } from "../useScenes";
import { useWorkspace } from "../WorkspaceContext";

export const newScene = (collectionId?: string) =>
  navigateTo(collectionId ? `/s/new?collection=${collectionId}` : "/s/new");

export function StartDrawingButton({
  collectionId,
}: {
  collectionId?: string;
}) {
  return (
    <Button variant="primary" onClick={() => newScene(collectionId)}>
      <PencilIcon />
      Start drawing
    </Button>
  );
}

export function HomePage() {
  const { workspace } = useWorkspace();
  const recent = useScenes({
    workspaceId: workspace.id,
    view: "recent",
    limit: 8,
  });
  const visited = useScenes({
    workspaceId: workspace.id,
    view: "visited",
    limit: 8,
  });
  const reloadAll = () => {
    recent.reload();
    visited.reload();
  };
  const loading = recent.scenes === null || visited.scenes === null;
  const isEmpty = !loading && !recent.scenes!.length && !visited.scenes!.length;

  return (
    <>
      <PageHeader
        icon={<DashboardIcon className="h-6 w-6" />}
        title="Dashboard"
        subtitle={
          <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-2 py-1">
            <InfoIcon className="h-3.5 w-3.5" />
            <b className="font-medium">Tip:</b> Press Alt+A to create a scene
            instantly.
          </span>
        }
        actions={<StartDrawingButton />}
      />
      <ErrorBanner message={recent.error || visited.error} />

      {loading && <p className="text-sm text-gray-500">Loading...</p>}
      {isEmpty && (
        <EmptyState
          icon={<PencilIcon className="h-5 w-5" />}
          title="No scenes yet"
          description="Scenes you create or edit will show up here."
          action={<StartDrawingButton />}
        />
      )}
      {!loading && recent.scenes!.length > 0 && (
        <Section title="Recently modified by you">
          <SceneGrid scenes={recent.scenes!} onChanged={reloadAll} />
        </Section>
      )}
      {!loading && visited.scenes!.length > 0 && (
        <Section title="Recently visited by you">
          <SceneGrid scenes={visited.scenes!} onChanged={reloadAll} />
        </Section>
      )}
    </>
  );
}
