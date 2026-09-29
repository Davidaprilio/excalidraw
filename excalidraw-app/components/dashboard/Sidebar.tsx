import { useState } from "react";

import api from "../../data/api";
import { useAuth } from "../../auth/AuthContext";
import { navigateTo } from "../../navigation";

import {
  ChevronsUpDownIcon,
  DashboardIcon,
  FolderIcon,
  LockIcon,
  LogOutIcon,
  SlidersIcon,
  UserIcon,
  MoreIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  TrashIcon,
  UsersIcon,
} from "./icons";
import { Avatar, DropdownMenu, PromptDialog, useToast } from "./ui";
import { useWorkspace } from "./WorkspaceContext";

import type { Collection } from "../../data/api";
import type { ReactNode } from "react";

export function Sidebar({
  path,
  onOpenSearch,
}: {
  path: string;
  onOpenSearch: () => void;
}) {
  const { user, logout } = useAuth();
  const [creatingCollection, setCreatingCollection] = useState(false);
  const { collections } = useWorkspace();

  return (
    <aside className="flex h-screen w-72 shrink-0 flex-col border-r border-gray-200 bg-gray-50/60">
      <div className="p-3">
        <WorkspaceSwitcher />
        <button
          type="button"
          onClick={onOpenSearch}
          className="mt-3 flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 hover:border-gray-300"
        >
          <SearchIcon />
          <span className="flex-1 text-left">Quick search</span>
          <kbd className="text-[11px] text-gray-400">Ctrl+P</kbd>
        </button>
      </div>

      <nav className="flex flex-col gap-0.5 px-3">
        <NavItem href="/" path={path} icon={<DashboardIcon />}>
          Dashboard
        </NavItem>
        <NavItem href="/settings" path={path} icon={<SettingsIcon />}>
          Workspace settings
        </NavItem>
        <NavItem href="/members" path={path} icon={<UsersIcon />}>
          Team members
        </NavItem>
        <NavItem href="/trash" path={path} icon={<TrashIcon />}>
          Trash
        </NavItem>
      </nav>

      <div className="mt-6 flex items-center justify-between px-5">
        <h2 className="text-sm font-semibold text-indigo-600">Collections</h2>
        <button
          type="button"
          aria-label="New collection"
          onClick={() => setCreatingCollection(true)}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2 flex-1 overflow-y-auto px-3 pb-3">
        {collections.map((collection) => (
          <CollectionItem
            key={collection.id}
            collection={collection}
            path={path}
          />
        ))}
      </div>

      <div className="border-t border-gray-200 p-3">
        {/* opens upwards; more account items (devices, passkeys...) go here */}
        <DropdownMenu
          side="top"
          align="left"
          label="Account menu"
          triggerClassName="flex w-full items-center gap-3 rounded-lg p-1.5 text-left hover:bg-gray-100"
          menuClassName="w-full"
          trigger={
            <>
              <Avatar
                name={user?.name || user?.email || "?"}
                src={user && api.avatarUrl(user.id, user.avatar_version)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-gray-900">
                  {user?.name}
                </span>
                <span className="block truncate text-xs text-gray-500">
                  {user?.email}
                </span>
              </span>
              <ChevronsUpDownIcon className="h-4 w-4 text-gray-400" />
            </>
          }
          items={[
            {
              label: "Account settings",
              icon: <UserIcon />,
              onSelect: () => navigateTo("/account"),
            },
            {
              label: "Preferences",
              icon: <SlidersIcon />,
              onSelect: () => navigateTo("/preferences"),
            },
            "separator",
            { label: "Log out", icon: <LogOutIcon />, onSelect: logout },
          ]}
        />
      </div>

      {creatingCollection && (
        <CreateCollectionDialog onClose={() => setCreatingCollection(false)} />
      )}
    </aside>
  );
}

function NavItem({
  href,
  path,
  icon,
  children,
}: {
  href: string;
  path: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  const active = path === href;
  return (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        navigateTo(href);
      }}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
        active
          ? "bg-indigo-50 font-medium text-indigo-700"
          : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      {icon}
      {children}
    </a>
  );
}

function WorkspaceSwitcher() {
  const { workspace, workspaces, switchWorkspace, reloadWorkspaces } =
    useWorkspace();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <DropdownMenu
        align="left"
        label="Switch workspace"
        triggerClassName="flex w-full items-center gap-3 rounded-lg p-1.5 text-left hover:bg-gray-100"
        trigger={
          <>
            <Avatar name={workspace.name} size="h-9 w-9 text-base" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
              {workspace.name}
            </span>
            <ChevronsUpDownIcon className="h-4 w-4 text-gray-400" />
          </>
        }
        items={[
          ...workspaces.map((w) => ({
            label:
              w.is_personal && w.is_owner ? `${w.name} (personal)` : w.name,
            checked: w.id === workspace.id,
            onSelect: () => switchWorkspace(w.id),
          })),
          "separator",
          {
            label: "Create workspace",
            icon: <PlusIcon />,
            onSelect: () => setCreating(true),
          },
        ]}
      />
      {creating && (
        <PromptDialog
          title="Create workspace"
          label="Workspace name"
          placeholder="e.g. Acme Design"
          confirmLabel="Create"
          onClose={() => setCreating(false)}
          onSubmit={async (name) => {
            const res = await api.createWorkspace(name);
            await reloadWorkspaces();
            switchWorkspace(res.workspace.id);
          }}
        />
      )}
    </>
  );
}

function CollectionItem({
  collection,
  path,
}: {
  collection: Collection;
  path: string;
}) {
  const { user } = useAuth();
  const { workspace, reloadCollections } = useWorkspace();
  const toast = useToast();
  const [renaming, setRenaming] = useState(false);
  const href = `/collections/${collection.id}`;
  const active = path === href;
  const canManage =
    !collection.is_personal &&
    (collection.owner_id === user?.id || workspace.role === "admin");

  const update = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      await reloadCollections();
      toast(message);
    } catch (err: any) {
      toast(err.message);
    }
  };

  return (
    <div
      className={`group flex items-center rounded-lg ${
        active
          ? "bg-indigo-50 text-indigo-700"
          : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <a
        href={href}
        onClick={(event) => {
          event.preventDefault();
          navigateTo(href);
        }}
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-sm"
      >
        {collection.visibility === "private" ? <LockIcon /> : <FolderIcon />}
        <span className="truncate">{collection.name}</span>
        <span className="ml-auto text-xs text-gray-400">
          {collection.scene_count}
        </span>
      </a>
      {canManage && (
        <div className="pr-1 opacity-0 group-hover:opacity-100 has-[[aria-expanded=true]]:opacity-100">
          <DropdownMenu
            label="Collection actions"
            triggerClassName="flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-200"
            trigger={<MoreIcon />}
            items={[
              {
                label: "Rename",
                onSelect: () => setRenaming(true),
              },
              collection.visibility === "workspace"
                ? {
                    label: "Make private",
                    icon: <LockIcon />,
                    onSelect: () =>
                      update(
                        () =>
                          api.updateCollection(workspace.id, collection.id, {
                            visibility: "private",
                          }),
                        "Only you can see this collection now",
                      ),
                  }
                : {
                    label: "Share with workspace",
                    icon: <UsersIcon />,
                    onSelect: () =>
                      update(
                        () =>
                          api.updateCollection(workspace.id, collection.id, {
                            visibility: "workspace",
                          }),
                        "Everyone in the workspace can see this collection",
                      ),
                  },
              "separator",
              {
                label: "Delete collection",
                icon: <TrashIcon />,
                danger: true,
                onSelect: () => {
                  if (
                    window.confirm(
                      `Delete "${collection.name}"? Its scenes will be moved to the trash.`,
                    )
                  ) {
                    update(
                      () => api.deleteCollection(workspace.id, collection.id),
                      "Collection deleted",
                    ).then(() => active && navigateTo("/"));
                  }
                },
              },
            ]}
          />
        </div>
      )}
      {renaming && (
        <PromptDialog
          title="Rename collection"
          label="Name"
          initialValue={collection.name}
          confirmLabel="Save"
          onClose={() => setRenaming(false)}
          onSubmit={async (name) => {
            await api.updateCollection(workspace.id, collection.id, { name });
            await reloadCollections();
          }}
        />
      )}
    </div>
  );
}

function CreateCollectionDialog({ onClose }: { onClose: () => void }) {
  const { workspace, reloadCollections } = useWorkspace();
  const [visibility, setVisibility] =
    useState<Collection["visibility"]>("workspace");

  return (
    <PromptDialog
      title="New collection"
      label="Name"
      placeholder="e.g. Product roadmap"
      confirmLabel="Create"
      onClose={onClose}
      onSubmit={async (name) => {
        const res = await api.createCollection(workspace.id, {
          name,
          visibility,
        });
        await reloadCollections();
        navigateTo(`/collections/${res.collection.id}`);
      }}
    >
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1.5 font-medium text-gray-700">
          Who can see it
        </legend>
        {(
          [
            ["workspace", "Everyone in this workspace", <UsersIcon key="u" />],
            ["private", "Only me", <LockIcon key="l" />],
          ] as const
        ).map(([value, label, icon]) => (
          <label
            key={value}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 ${
              visibility === value
                ? "border-indigo-500 bg-indigo-50"
                : "border-gray-200"
            }`}
          >
            <input
              type="radio"
              name="visibility"
              className="accent-indigo-600"
              checked={visibility === value}
              onChange={() => setVisibility(value)}
            />
            <span className="text-gray-500">{icon}</span>
            {label}
          </label>
        ))}
      </fieldset>
    </PromptDialog>
  );
}
