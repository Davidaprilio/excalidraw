import { useEffect, useState } from "react";

import api from "../../data/api";
import { useAuth } from "../../auth/AuthContext";

import { Button, Modal } from "./ui";

import type { Workspace, WorkspaceMember } from "../../data/api";
import type { ReactNode } from "react";

/**
 * Delete (to the owner's trash) with three confirmations: what gets deleted,
 * are you sure, then typing "delete <workspace name>" enables the button.
 */
export function DeleteWorkspaceDialog({
  workspace,
  intro,
  onClose,
  onDeleted,
}: {
  workspace: Workspace;
  /** extra first line, e.g. why leaving turned into deleting */
  intro?: ReactNode;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const confirmText = `delete ${workspace.name}`;
  const scenes = `${workspace.scene_count} scene${
    workspace.scene_count === 1 ? "" : "s"
  }`;

  const remove = async () => {
    setBusy(true);
    try {
      await api.deleteWorkspace(workspace.id);
      onDeleted();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (step === 1) {
    return (
      <Modal title={`Delete "${workspace.name}"?`} onClose={onClose}>
        <div className="flex flex-col gap-3 text-sm text-gray-600">
          {intro}
          <p>
            All <b className="font-semibold text-gray-900">{scenes}</b> and
            every collection in this workspace will be deleted together with it.
          </p>
        </div>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={() => setStep(2)}>
            Delete workspace
          </Button>
        </DialogActions>
      </Modal>
    );
  }

  if (step === 2) {
    return (
      <Modal title="Are you absolutely sure?" onClose={onClose}>
        <div className="flex flex-col gap-3 text-sm text-gray-600">
          <p>
            The {workspace.member_count} member
            {workspace.member_count === 1 ? "" : "s"} of{" "}
            <b className="font-semibold text-gray-900">{workspace.name}</b> will
            immediately lose access to its {scenes}.
          </p>
          <p>
            The workspace goes to the Trash of your personal workspace, where
            you can restore it or delete it forever.
          </p>
        </div>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={() => setStep(3)}>
            I understand, continue
          </Button>
        </DialogActions>
      </Modal>
    );
  }

  return (
    <Modal title="Confirm deletion" onClose={onClose}>
      <label className="flex flex-col gap-2 text-sm text-gray-600">
        <span>
          Type{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-900 select-all">
            {confirmText}
          </code>{" "}
          to confirm.
        </span>
        <input
          autoFocus
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) =>
            event.key === "Enter" && typed === confirmText && remove()
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
        />
      </label>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="danger"
          disabled={typed !== confirmText || busy}
          onClick={remove}
        >
          Delete workspace
        </Button>
      </DialogActions>
    </Modal>
  );
}

/**
 * Leave a workspace. The owner first picks a new owner; with nobody to hand it
 * to, leaving turns into deleting the workspace.
 */
export function LeaveWorkspaceDialog({
  workspace,
  onClose,
  onLeft,
}: {
  workspace: Workspace;
  onClose: () => void;
  onLeft: () => void;
}) {
  const { user } = useAuth();
  const [others, setOthers] = useState<WorkspaceMember[] | null>(null);
  const [newOwnerId, setNewOwnerId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!workspace.is_owner) {
      return;
    }
    api
      .listMembers(workspace.id)
      .then((res) => {
        const rest = res.members.filter((m) => m.id !== user?.id);
        setOthers(rest);
        setNewOwnerId(
          rest.find((m) => m.role === "admin")?.id ?? rest[0]?.id ?? "",
        );
      })
      .catch((err) => setError(err.message));
  }, [workspace.id, workspace.is_owner, user?.id]);

  const leave = async () => {
    setBusy(true);
    try {
      await api.leaveWorkspace(
        workspace.id,
        workspace.is_owner ? newOwnerId : undefined,
      );
      onLeft();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (workspace.is_owner && others?.length === 0) {
    return (
      <DeleteWorkspaceDialog
        workspace={workspace}
        intro={
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
            You're the only member, so there's nobody to hand this workspace to.
            Leaving it deletes it.
          </p>
        }
        onClose={onClose}
        onDeleted={onLeft}
      />
    );
  }

  return (
    <Modal title={`Leave "${workspace.name}"?`} onClose={onClose}>
      <div className="flex flex-col gap-3 text-sm text-gray-600">
        <p>
          You'll lose access to its scenes. Scenes you own stay in the
          workspace.
        </p>
        {workspace.is_owner &&
          (others === null ? (
            <p>Loading members...</p>
          ) : (
            <label className="flex flex-col gap-1.5 font-medium text-gray-700">
              You own this workspace. Choose its new owner first:
              <select
                value={newOwnerId}
                onChange={(event) => setNewOwnerId(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal"
              >
                {others.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.email})
                    {member.role === "admin" ? " · admin" : ""}
                  </option>
                ))}
              </select>
            </label>
          ))}
        {error && <p className="text-red-600">{error}</p>}
      </div>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="danger"
          disabled={busy || (workspace.is_owner && !newOwnerId)}
          onClick={leave}
        >
          {workspace.is_owner ? "Transfer ownership & leave" : "Leave"}
        </Button>
      </DialogActions>
    </Modal>
  );
}

function DialogActions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex justify-end gap-2">{children}</div>;
}
