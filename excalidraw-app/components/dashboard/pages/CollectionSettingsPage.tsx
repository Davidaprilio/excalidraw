import { useEffect, useState } from "react";

import api from "../../../data/api";
import { useAuth } from "../../../auth/AuthContext";
import { navigateTo } from "../../../navigation";
import {
  CopyIcon,
  FolderIcon,
  LinkIcon,
  SettingsIcon,
  UnlinkIcon,
} from "../icons";
import { CollectionAccessPanel } from "../CollectionAccessPanel";
import { Button, EmptyState, PageHeader, useToast } from "../ui";
import { DeleteCollectionDialog } from "../WorkspaceDialogs";
import { useCollection } from "../useCollection";
import { useWorkspace } from "../WorkspaceContext";

import { Card, Row } from "./SettingsPage";

import type { WorkspaceMember } from "../../../data/api";

import type { FormEvent } from "react";

export const collectionShareUrl = (token: string) =>
  `${window.location.origin}/share/c/${token}`;

/** /collections/:id/settings: rename, share link, transfer, delete; access on the right */
export function CollectionSettingsPage({
  collectionId,
}: {
  collectionId: string;
}) {
  const { user } = useAuth();
  const {
    workspace: currentWorkspace,
    workspaces,
    switchWorkspace,
  } = useWorkspace();
  // the collection and its workspace (maybe another one: I'm a guest there)
  const {
    collection,
    workspace,
    guest,
    loaded: collectionsLoaded,
    reload: reloadCollections,
  } = useCollection(collectionId);
  const toast = useToast();
  const [name, setName] = useState(collection?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // the checkbox's value while its change is being saved
  const [pendingAllowSave, setPendingAllowSave] = useState<boolean | null>(
    null,
  );

  useEffect(() => setName(collection?.name ?? ""), [collection?.name]);

  // Transfer: new owner (a workspace member) or another workspace
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [newOwnerId, setNewOwnerId] = useState("");
  const [targetWorkspaceId, setTargetWorkspaceId] = useState("");
  useEffect(() => {
    if (guest) {
      return;
    }
    api
      .listMembers(workspace.id)
      .then((res) => setMembers(res.members))
      .catch(() => {});
  }, [workspace.id, guest]);

  if (!collection) {
    return !collectionsLoaded ? null : (
      <EmptyState
        icon={<FolderIcon className="h-5 w-5" />}
        title="Collection not found"
        description="It may have been deleted, or it belongs to another workspace."
      />
    );
  }

  const canManage = !collection.is_personal && collection.my_role === "manage";
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

  // transfers stay with its workspace's people: its owner or an admin there
  const canTransfer =
    !guest &&
    (collection.owner_id === user?.id ||
      (currentWorkspace.id === workspace.id &&
        currentWorkspace.role === "admin"));
  const otherWorkspaces = workspaces.filter((w) => w.id !== workspace.id);
  const ownerCandidates = members.filter(
    (member) => member.id !== collection.owner_id,
  );

  const transferOwner = () => {
    const member = members.find((m) => m.id === newOwnerId);
    if (
      member &&
      window.confirm(
        `Make ${member.name || member.email} the owner of "${
          collection.name
        }"? You keep "Can manage".`,
      )
    ) {
      run(
        () =>
          api.transferCollectionOwner(workspace.id, collection.id, member.id),
        `${member.name || member.email} now owns this collection`,
      ).then(() => setNewOwnerId(""));
    }
  };

  const moveToWorkspace = () => {
    const target = workspaces.find((w) => w.id === targetWorkspaceId);
    if (
      !target ||
      !window.confirm(
        `Move "${collection.name}" and its ${scenes} to ${target.name}? People who aren't members of ${target.name} lose access to it.`,
      )
    ) {
      return;
    }
    setBusy(true);
    api
      .moveCollection(workspace.id, collection.id, target.id)
      .then(() => {
        toast(`Moved to ${target.name}`);
        // follow it to its new workspace
        switchWorkspace(target.id);
        navigateTo(`/collections/${collection.id}/settings`);
      })
      .catch((err) => toast(err.message))
      .finally(() => setBusy(false));
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
            : "Only people who can manage this collection can change its settings."}
        </p>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-6">
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

            <Card title="Share with link">
              {isPrivate ? (
                <p className="text-sm text-gray-500">
                  Private collections can't be shared by link. Give everyone in{" "}
                  {workspace.name} access (in Access) to share it.
                </p>
              ) : (
                <>
                  <Row
                    title={shareUrl ? "Link sharing is on" : "Read-only link"}
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
                        checked={
                          pendingAllowSave ?? collection.share_allow_save
                        }
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
                </>
              )}
            </Card>

            {canTransfer && (
              <Card title="Transfer">
                <div className="flex flex-col gap-5">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Transfer ownership
                    </p>
                    <p className="mt-0.5 mb-2.5 text-sm text-gray-500">
                      Owner: {collection.owner_name || "nobody"}. The new owner
                      must be in {workspace.name}; the previous owner keeps "Can
                      manage".
                    </p>
                    <div className="flex gap-2">
                      <select
                        aria-label="New owner"
                        value={newOwnerId}
                        onChange={(event) => setNewOwnerId(event.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="">Choose a member...</option>
                        {ownerCandidates.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name || member.email} ({member.email})
                          </option>
                        ))}
                      </select>
                      <Button
                        disabled={busy || !newOwnerId}
                        onClick={transferOwner}
                      >
                        Transfer
                      </Button>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-5">
                    <p className="text-sm font-medium text-gray-900">
                      Move to another workspace
                    </p>
                    <p className="mt-0.5 mb-2.5 text-sm text-gray-500">
                      Moves the collection with its {scenes}. People who aren't
                      members of that workspace lose access.
                    </p>
                    {otherWorkspaces.length ? (
                      <div className="flex gap-2">
                        <select
                          aria-label="Target workspace"
                          value={targetWorkspaceId}
                          onChange={(event) =>
                            setTargetWorkspaceId(event.target.value)
                          }
                          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        >
                          <option value="">Choose a workspace...</option>
                          {otherWorkspaces.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          disabled={busy || !targetWorkspaceId}
                          onClick={moveToWorkspace}
                        >
                          Move
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">
                        You're not a member of any other workspace.
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            )}

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

          <div className="min-w-0 lg:sticky lg:top-0">
            <CollectionAccessPanel
              workspace={workspace}
              collection={collection}
              myWorkspaces={workspaces}
              onChanged={reloadCollections}
            />
          </div>
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
