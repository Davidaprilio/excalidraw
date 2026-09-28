import { useEffect, useState } from "react";

import api from "../../../data/api";
import { useAuth } from "../../../auth/AuthContext";
import { setStoredWorkspaceId } from "../../../data/workspace";
import { navigateTo } from "../../../navigation";
import { Avatar, Button } from "../ui";

type InviteInfo = Awaited<ReturnType<typeof api.getInvite>>["invite"];

/** /invite/:token — join a workspace (the user is already logged in by the auth gate). */
export function InvitePage({ token }: { token: string }) {
  const { user, logout } = useAuth();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getInvite(token)
      .then((res) => setInvite(res.invite))
      .catch((err) => setError(err.message));
  }, [token]);

  const openWorkspace = (workspaceId: string) => {
    setStoredWorkspaceId(workspaceId);
    navigateTo("/", { replace: true });
  };

  const accept = async () => {
    setBusy(true);
    try {
      const res = await api.acceptInvite(token);
      openWorkspace(res.workspaceId);
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  const wrongAccount =
    invite?.email && user?.email.toLowerCase() !== invite.email;

  return (
    <div className="dashboard-root flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        {!invite && !error && (
          <p className="text-sm text-gray-500">Loading...</p>
        )}
        {error && !invite && (
          <>
            <h1 className="text-lg font-semibold text-gray-900">
              Invite unavailable
            </h1>
            <p className="mt-2 text-sm text-gray-500">{error}</p>
            <Button className="mt-6" onClick={() => navigateTo("/")}>
              Go to dashboard
            </Button>
          </>
        )}
        {invite && (
          <>
            <div className="flex justify-center">
              <Avatar name={invite.workspaceName} size="h-14 w-14 text-2xl" />
            </div>
            <h1 className="mt-4 text-lg font-semibold text-gray-900">
              Join {invite.workspaceName}
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              {invite.invitedByName ?? "Someone"} invited you as{" "}
              {invite.role === "admin" ? "an admin" : "a member"}.
            </p>
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            {invite.alreadyMember ? (
              <Button
                variant="primary"
                className="mt-6 w-full"
                onClick={() => openWorkspace(invite.workspaceId)}
              >
                You're already a member · Open workspace
              </Button>
            ) : wrongAccount ? (
              <>
                <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  This invite is for {invite.email}, but you're signed in as{" "}
                  {user?.email}.
                </p>
                <Button className="mt-4 w-full" onClick={logout}>
                  Sign in with another account
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                className="mt-6 w-full"
                disabled={busy}
                onClick={accept}
              >
                Accept invite
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
