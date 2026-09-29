import { LinkIcon, usersIcon } from "@excalidraw/excalidraw/components/icons";
import { useEffect, useState } from "react";

import { useOptionalAuth } from "../auth/AuthContext";
import api from "../data/api";
import { serverData } from "../data/ServerData";
import { setStoredWorkspaceId } from "../data/workspace";
import { navigateTo } from "../navigation";

import { tooltip } from "./comments/CommentParts";
import { Avatar } from "./dashboard/ui";

import "./SceneUsersPanel.scss";

import type { SceneAccess, SceneAccessUser } from "../data/api";

const ACCESS: Record<
  SceneAccessUser["access"],
  { label: string; details: string }
> = {
  owner: {
    label: "Owner",
    details: "Created this scene: can edit, share, move and delete it",
  },
  admin: {
    label: "Admin",
    details: "Workspace admin: can edit, share, move and delete it",
  },
  editor: {
    label: "Can edit",
    details: "Workspace member: can edit, comment and share it",
  },
};

/**
 * Right sidebar "Users" tab (self-hosted): who can open this scene and with
 * which rights. Read only: changes are made from the dashboard.
 */
export function SceneUsersPanel() {
  const userId = useOptionalAuth()?.user?.id;
  const [sceneId, setSceneId] = useState(
    () => serverData.getSceneInfo()?.id ?? null,
  );
  const [access, setAccess] = useState<SceneAccess | null>(null);
  const [error, setError] = useState("");

  // the scene gets its id on its first save
  useEffect(
    () =>
      serverData.subscribe(() =>
        setSceneId(serverData.getSceneInfo()?.id ?? null),
      ),
    [],
  );

  useEffect(() => {
    if (!sceneId) {
      return;
    }
    let cancelled = false;
    setError("");
    api
      .getSceneAccess(sceneId)
      .then((res) => !cancelled && setAccess(res.access))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [sceneId]);

  if (!sceneId) {
    return (
      <p className="app-users-panel__empty">
        Draw something first: the scene is shared once it's saved.
      </p>
    );
  }
  if (error) {
    return <p className="app-users-panel__empty">{error}</p>;
  }
  if (!access) {
    return <p className="app-users-panel__empty">Loading...</p>;
  }

  // in the dashboard of the scene's workspace
  const openDashboard = (path: string) => {
    setStoredWorkspaceId(access.workspace.id);
    navigateTo(path);
  };

  const shared = access.collection?.visibility === "workspace";
  const owner = access.users.find((user) => user.access === "owner");

  return (
    <div className="app-users-panel">
      <p className="app-users-panel__summary">
        {shared ? (
          <>
            Everyone in <b>{access.workspace.name}</b> can open this scene: it's
            in the shared collection <b>{access.collection!.name}</b>.
          </>
        ) : (
          <>
            Only{" "}
            <b>{owner?.id === userId ? "you" : owner?.name || owner?.email}</b>{" "}
            can open this scene: it's in a private collection
            {access.collection ? (
              <>
                {" "}
                (<b>{access.collection.name}</b>)
              </>
            ) : null}
            .
          </>
        )}
      </p>

      {access.is_shared && (
        <div className="app-users-panel__row">
          <span className="app-users-panel__icon">{LinkIcon}</span>
          <span className="app-users-panel__who">
            <b>Anyone with the link</b>
            <small>Public share link</small>
          </span>
          <span
            className="app-users-panel__badge"
            {...tooltip("Can open a read-only copy", true)}
          >
            Can view
          </span>
        </div>
      )}

      <h3 className="app-users-panel__heading">
        People with access · {access.users.length}
      </h3>
      <ul className="app-users-panel__list">
        {access.users.map((user) => (
          <li key={user.id} className="app-users-panel__row">
            <Avatar
              name={user.name || user.email}
              size="app-users-panel__avatar"
              src={api.avatarUrl(user.id, user.avatar_version)}
            />
            <span className="app-users-panel__who">
              <b>
                {user.name || user.email}
                {user.id === userId && <em> (you)</em>}
              </b>
              <small>{user.email}</small>
            </span>
            <span
              className={`app-users-panel__badge is-${user.access}`}
              {...tooltip(ACCESS[user.access].details, true)}
            >
              {ACCESS[user.access].label}
            </span>
          </li>
        ))}
      </ul>

      <div className="app-users-panel__footer">
        <p>Change access or remove people from the dashboard.</p>
        <button type="button" onClick={() => openDashboard("/members")}>
          {usersIcon}
          Manage members
        </button>
        {access.collection && (
          <button
            type="button"
            onClick={() =>
              openDashboard(`/collections/${access.collection!.id}`)
            }
          >
            Open collection
          </button>
        )}
      </div>
    </div>
  );
}
