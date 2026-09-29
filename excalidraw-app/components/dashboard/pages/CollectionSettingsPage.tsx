import { useEffect, useState } from "react";

import api from "../../../data/api";
import { useAuth } from "../../../auth/AuthContext";
import { navigateTo } from "../../../navigation";
import {
  CopyIcon,
  FolderIcon,
  LinkIcon,
  LockIcon,
  SettingsIcon,
  UnlinkIcon,
} from "../icons";
import { Button, EmptyState, PageHeader, useToast } from "../ui";
import { DeleteCollectionDialog } from "../WorkspaceDialogs";
import { useWorkspace } from "../WorkspaceContext";

import { Card, Row } from "./SettingsPage";

import type { FormEvent } from "react";

export const collectionShareUrl = (token: string) =>
  `${window.location.origin}/share/c/${token}`;

/** /collections/:id/settings: rename, visibility, share link, delete */
export function CollectionSettingsPage({
  collectionId,
}: {
  collectionId: string;
}) {
  const { user } = useAuth();
  const { workspace, collections, collectionsLoaded, reloadCollections } =
    useWorkspace();
  const toast = useToast();
  const collection = collections.find((c) => c.id === collectionId);
  const [name, setName] = useState(collection?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // the checkbox's value while its change is being saved
  const [pendingAllowSave, setPendingAllowSave] = useState<boolean | null>(
    null,
  );

  useEffect(() => setName(collection?.name ?? ""), [collection?.name]);

  if (!collection) {
    return !collectionsLoaded ? null : (
      <EmptyState
        icon={<FolderIcon className="h-5 w-5" />}
        title="Collection not found"
        description="It may have been deleted, or it belongs to another workspace."
      />
    );
  }

  const canManage =
    !collection.is_personal &&
    (collection.owner_id === user?.id || workspace.role === "admin");
  const collectionHref = `/collections/${collection.id}`;
  const isPrivate = collection.visibility === "private";
  const shareUrl = collection.share_token
    ? collectionShareUrl(collection.share_token)
    : null;
  const scenes = `${collection.scene_count} scene${
    collection.scene_count === 1 ? "" : "s"
  }`;

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await action();
      await reloadCollections();
      toast(message);
    } catch (err: any) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const rename = (event: FormEvent) => {
    event.preventDefault();
    run(
      () =>
        api.updateCollection(workspace.id, collection.id, {
          name: name.trim(),
        }),
      "Collection renamed",
    );
  };

  const copyLink = (url: string) =>
    navigator.clipboard
      .writeText(url)
      .then(() => toast("Share link copied"))
      .catch(() => toast(url));

  return (
    <>
      <PageHeader
        icon={<SettingsIcon className="h-6 w-6" />}
        title="Collection settings"
        subtitle={
          <>
            <a
              href={collectionHref}
              onClick={(event) => {
                event.preventDefault();
                navigateTo(collectionHref);
              }}
              className="font-medium text-indigo-600 hover:underline"
            >
              {collection.name}
            </a>{" "}
            · {scenes}
          </>
        }
      />

      {!canManage ? (
        <p className="max-w-2xl text-sm text-gray-500">
          {collection.is_personal
            ? "Your Private collection can't be renamed, shared or deleted."
            : "Only the collection's owner or a workspace admin can change its settings."}
        </p>
      ) : (
        <div className="flex max-w-2xl flex-col gap-6">
          <Card title="General">
            <form onSubmit={rename} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Collection name
                <input
                  value={name}
                  maxLength={255}
                  onChange={(event) => setName(event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={
                    busy || !name.trim() || name.trim() === collection.name
                  }
                >
                  Save
                </Button>
              </div>
            </form>
          </Card>

          <Card title="Access">
            <div className="flex flex-col gap-5">
              <Row
                title={
                  isPrivate ? "Private collection" : "Shared with workspace"
                }
                description={
                  isPrivate
                    ? `Only ${
                        collection.owner_id === user?.id
                          ? "you"
                          : collection.owner_name || "its owner"
                      } can see it in ${workspace.name}.`
                    : `Everyone in ${workspace.name} can see and edit its scenes.`
                }
                action={
                  <Button
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          api.updateCollection(workspace.id, collection.id, {
                            visibility: isPrivate ? "workspace" : "private",
                          }),
                        isPrivate
                          ? "Everyone in the workspace can see this collection"
                          : "Only you can see this collection now",
                      )
                    }
                  >
                    {isPrivate ? (
                      <>
                        <FolderIcon /> Share with workspace
                      </>
                    ) : (
                      <>
                        <LockIcon /> Make private
                      </>
                    )}
                  </Button>
                }
              />

              <div className="border-t border-gray-100 pt-5">
                <Row
                  title="Share with link"
                  description={
                    shareUrl
                      ? `Anyone with the link can view all ${scenes} (read only), including scenes added later.`
                      : "Create a read-only link to every scene in this collection. No login needed to view."
                  }
                  action={
                    shareUrl ? (
                      <Button
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Stop sharing this collection? The current link stops working; sharing again creates a new one.",
                            )
                          ) {
                            run(
                              () =>
                                api.unshareCollection(
                                  workspace.id,
                                  collection.id,
                                ),
                              "Link sharing stopped",
                            );
                          }
                        }}
                      >
                        <UnlinkIcon /> Stop sharing
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            const res = await api.shareCollection(
                              workspace.id,
                              collection.id,
                            );
                            await copyLink(
                              collectionShareUrl(res.collection.share_token),
                            );
                          }, "Share link created")
                        }
                      >
                        <LinkIcon /> Create link
                      </Button>
                    )
                  }
                />
                {shareUrl && (
                  <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={pendingAllowSave ?? collection.share_allow_save}
                      disabled={busy}
                      onChange={(event) => {
                        const allowSave = event.target.checked;
                        setPendingAllowSave(allowSave);
                        run(
                          () =>
                            api.setCollectionShareAllowSave(
                              workspace.id,
                              collection.id,
                              allowSave,
                            ),
                          allowSave
                            ? "Viewers can save copies"
                            : "Viewers can no longer save copies",
                        ).finally(() => setPendingAllowSave(null));
                      }}
                      className="mt-0.5 accent-indigo-600"
                    />
                    <span>
                      Allow viewers to save a copy
                      <span className="block text-xs text-gray-500">
                        "Save to..." in the viewer's menu. Off by default for
                        every new link.
                      </span>
                    </span>
                  </label>
                )}
                {shareUrl && (
                  <div className="mt-3 flex gap-2">
                    <input
                      readOnly
                      aria-label="Share link"
                      value={shareUrl}
                      onFocus={(event) => event.target.select()}
                      className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700 outline-none"
                    />
                    <Button onClick={() => copyLink(shareUrl)}>
                      <CopyIcon /> Copy link
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card title="Danger zone" danger>
            <Row
              title="Delete collection"
              description={`Moves its ${scenes} to the trash and stops its share link.`}
              action={
                <Button variant="danger" onClick={() => setDeleting(true)}>
                  Delete collection
                </Button>
              }
            />
          </Card>
        </div>
      )}

      {deleting && (
        <DeleteCollectionDialog
          workspaceId={workspace.id}
          collection={collection}
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            setDeleting(false);
            toast(`"${collection.name}" deleted`);
            navigateTo("/");
            reloadCollections().catch(() => {});
          }}
        />
      )}
    </>
  );
}
