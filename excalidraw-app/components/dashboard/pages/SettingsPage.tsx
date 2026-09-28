import { useEffect, useState } from "react";

import api from "../../../data/api";
import { navigateTo } from "../../../navigation";
import { SettingsIcon } from "../icons";
import { Button, PageHeader, useToast } from "../ui";
import {
  DeleteWorkspaceDialog,
  LeaveWorkspaceDialog,
} from "../WorkspaceDialogs";
import { useWorkspace } from "../WorkspaceContext";

import type { FormEvent, ReactNode } from "react";

export function SettingsPage() {
  const { workspace, reloadWorkspaces } = useWorkspace();
  const toast = useToast();
  const isAdmin = workspace.role === "admin";
  const [name, setName] = useState(workspace.name);
  const [dialog, setDialog] = useState<"leave" | "delete" | null>(null);

  useEffect(() => setName(workspace.name), [workspace.id, workspace.name]);

  // The workspace is gone for us: fall back to the personal one
  const leftWorkspace = async (message: string) => {
    setDialog(null);
    toast(message);
    await reloadWorkspaces();
    navigateTo("/");
  };

  const rename = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.renameWorkspace(workspace.id, name.trim());
      await reloadWorkspaces();
      toast("Workspace renamed");
    } catch (err: any) {
      toast(err.message);
    }
  };

  const roleLabel = workspace.is_owner
    ? "the owner"
    : isAdmin
    ? "an admin"
    : "a member";

  return (
    <>
      <PageHeader
        icon={<SettingsIcon className="h-6 w-6" />}
        title="Workspace settings"
        subtitle={
          workspace.is_personal && workspace.is_owner
            ? "This is your personal workspace."
            : `You are ${roleLabel} of this workspace.`
        }
      />

      <div className="flex max-w-2xl flex-col gap-6">
        <Card title="General">
          <form onSubmit={rename} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
              Workspace name
              <input
                value={name}
                disabled={!isAdmin}
                maxLength={255}
                onChange={(event) => setName(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-50"
              />
            </label>
            {isAdmin && (
              <div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!name.trim() || name.trim() === workspace.name}
                >
                  Save
                </Button>
              </div>
            )}
          </form>
          {workspace.owner_name && !workspace.is_owner && (
            <p className="mt-4 text-sm text-gray-500">
              Owner: {workspace.owner_name}
            </p>
          )}
        </Card>

        {workspace.is_personal && workspace.is_owner ? (
          <Card title="Personal workspace">
            <p className="text-sm text-gray-500">
              Every account has one personal workspace. It can't be deleted or
              left, but you can invite people to it and create other workspaces
              from the workspace menu.
            </p>
          </Card>
        ) : (
          <Card title="Danger zone" danger>
            <div className="flex flex-col gap-4">
              <Row
                title="Leave workspace"
                description={
                  workspace.is_owner
                    ? "You own this workspace: you'll choose a new owner before leaving."
                    : "You'll lose access to its scenes. Your scenes stay in the workspace."
                }
                action={
                  <Button onClick={() => setDialog("leave")}>Leave</Button>
                }
              />
              {workspace.is_owner && (
                <Row
                  title="Delete workspace"
                  description="Deletes it with all its scenes and collections. You can restore it from the Trash of your personal workspace."
                  action={
                    <Button
                      variant="danger"
                      onClick={() => setDialog("delete")}
                    >
                      Delete workspace
                    </Button>
                  }
                />
              )}
            </div>
          </Card>
        )}
      </div>

      {dialog === "leave" && (
        <LeaveWorkspaceDialog
          workspace={workspace}
          onClose={() => setDialog(null)}
          onLeft={() => leftWorkspace(`You left ${workspace.name}`)}
        />
      )}
      {dialog === "delete" && (
        <DeleteWorkspaceDialog
          workspace={workspace}
          onClose={() => setDialog(null)}
          onDeleted={() => leftWorkspace(`${workspace.name} moved to trash`)}
        />
      )}
    </>
  );
}

function Card({
  title,
  danger,
  children,
}: {
  title: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border p-5 ${
        danger ? "border-red-200" : "border-gray-200"
      }`}
    >
      <h2
        className={`mb-4 text-sm font-semibold ${
          danger ? "text-red-700" : "text-gray-900"
        }`}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <div className="shrink-0 whitespace-nowrap">{action}</div>
    </div>
  );
}
