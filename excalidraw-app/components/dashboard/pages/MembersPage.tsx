import { useCallback, useEffect, useState } from "react";

import api from "../../../data/api";
import { useAuth } from "../../../auth/AuthContext";
import { LinkIcon, UsersIcon } from "../icons";
import {
  Avatar,
  Button,
  ErrorBanner,
  PageHeader,
  timeAgo,
  useToast,
} from "../ui";
import { LeaveWorkspaceDialog } from "../WorkspaceDialogs";
import { useWorkspace } from "../WorkspaceContext";
import { navigateTo } from "../../../navigation";

import type {
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceRole,
} from "../../../data/api";
import type { FormEvent } from "react";

const inviteUrl = (token: string) =>
  `${window.location.origin}/invite/${token}`;

export function MembersPage() {
  const { user } = useAuth();
  const { workspace, reloadWorkspaces } = useWorkspace();
  const toast = useToast();
  const isAdmin = workspace.role === "admin";
  const [members, setMembers] = useState<WorkspaceMember[] | null>(null);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [membersRes, invitesRes] = await Promise.all([
        api.listMembers(workspace.id),
        isAdmin ? api.listInvites(workspace.id) : { invites: [] },
      ]);
      setMembers(membersRes.members);
      setInvites(invitesRes.invites);
      setError("");
    } catch (err: any) {
      setError(err.message);
    }
  }, [workspace.id, isAdmin]);

  useEffect(() => {
    reload();
  }, [reload]);

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

  const copy = (token: string) =>
    navigator.clipboard
      .writeText(inviteUrl(token))
      .then(() => toast("Invite link copied"))
      .catch(() => toast(inviteUrl(token)));

  return (
    <>
      <PageHeader
        icon={<UsersIcon className="h-6 w-6" />}
        title="Team members"
        subtitle={`People in ${workspace.name}. Members can see and edit every scene in shared collections.`}
      />
      <ErrorBanner message={error} />

      {isAdmin && <InviteForm onInvited={reload} onCopy={copy} />}

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          Members {members && `(${members.length})`}
        </h2>
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
          {members?.map((member) => {
            const isMe = member.id === user?.id;
            return (
              <div
                key={member.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <Avatar name={member.name || member.email} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {member.name}{" "}
                    {isMe && <span className="text-gray-400">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {member.email}
                  </p>
                </div>
                {member.is_owner ? (
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                    Owner
                  </span>
                ) : isAdmin ? (
                  <select
                    aria-label={`Role of ${member.name}`}
                    value={member.role}
                    onChange={(event) =>
                      run(
                        () =>
                          api.updateMemberRole(
                            workspace.id,
                            member.id,
                            event.target.value as WorkspaceRole,
                          ),
                        "Role updated",
                      )
                    }
                    className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </select>
                ) : (
                  <span className="text-sm text-gray-500 capitalize">
                    {member.role}
                  </span>
                )}
                {!isMe && workspace.is_owner && !workspace.is_personal && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Make ${member.name} the owner of ${workspace.name}? You'll stay an admin, but only the new owner can delete the workspace.`,
                        )
                      ) {
                        run(
                          () =>
                            api.transferWorkspaceOwnership(
                              workspace.id,
                              member.id,
                            ),
                          `${member.name} is now the owner`,
                        );
                      }
                    }}
                  >
                    Make owner
                  </Button>
                )}
                {!isMe && isAdmin && !member.is_owner && (
                  <Button
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove ${member.name} from ${workspace.name}?`,
                        )
                      ) {
                        run(
                          () => api.removeMember(workspace.id, member.id),
                          "Member removed",
                        );
                      }
                    }}
                  >
                    Remove
                  </Button>
                )}
                {isMe && !(workspace.is_personal && workspace.is_owner) && (
                  <Button
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => setLeaving(true)}
                  >
                    Leave
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {isAdmin && invites.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Pending invites
          </h2>
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <LinkIcon className="h-4 w-4 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-gray-900">
                    {invite.email ?? "Invite link (anyone with the link)"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {invite.role} · expires {timeAgo(invite.expires_at)}
                  </p>
                </div>
                <Button onClick={() => copy(invite.token)}>Copy link</Button>
                <Button
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() =>
                    run(
                      () => api.revokeInvite(workspace.id, invite.id),
                      "Invite revoked",
                    )
                  }
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}
      {leaving && (
        <LeaveWorkspaceDialog
          workspace={workspace}
          onClose={() => setLeaving(false)}
          onLeft={async () => {
            setLeaving(false);
            toast(`You left ${workspace.name}`);
            await reloadWorkspaces();
            navigateTo("/");
          }}
        />
      )}
    </>
  );
}

function InviteForm({
  onInvited,
  onCopy,
}: {
  onInvited: () => void;
  onCopy: (token: string) => void;
}) {
  const { workspace } = useWorkspace();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [busy, setBusy] = useState(false);

  const invite = async (withEmail: boolean) => {
    setBusy(true);
    try {
      const res = await api.createInvite(workspace.id, {
        role,
        email: withEmail ? email.trim() : undefined,
      });
      onCopy(res.invite.token);
      setEmail("");
      onInvited();
    } catch (err: any) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (email.trim()) {
      invite(true);
    }
  };

  return (
    <section className="mb-10 rounded-xl border border-gray-200 bg-gray-50/60 p-5">
      <h2 className="text-sm font-semibold text-gray-900">Invite people</h2>
      <p className="mt-1 mb-4 text-sm text-gray-500">
        An email invite can only be accepted by that address. Emails aren't sent
        automatically: the invite link is copied for you to share.
      </p>
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <input
          type="email"
          value={email}
          placeholder="name@company.com"
          onChange={(event) => setEmail(event.target.value)}
          className="min-w-60 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <select
          aria-label="Role"
          value={role}
          onChange={(event) => setRole(event.target.value as WorkspaceRole)}
          className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <Button
          type="submit"
          variant="primary"
          disabled={busy || !email.trim()}
        >
          Send invite
        </Button>
        <Button disabled={busy} onClick={() => invite(false)}>
          <LinkIcon />
          Create invite link
        </Button>
      </form>
    </section>
  );
}
