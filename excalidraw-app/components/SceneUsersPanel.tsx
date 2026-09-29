import {
  copyIcon,
  LinkIcon,
  usersIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useCallback, useEffect, useState } from "react";

import { useOptionalAuth } from "../auth/AuthContext";
import api from "../data/api";
import { serverData } from "../data/ServerData";
import { setStoredWorkspaceId } from "../data/workspace";
import { navigateTo } from "../navigation";

import { tooltip } from "./comments/CommentParts";
import { useComments } from "./comments/CommentsContext";
import { Avatar } from "./dashboard/ui";

import "./SceneUsersPanel.scss";

import type { SceneAccess, SceneAccessUser } from "../data/api";

/** window event: the scene's access changed elsewhere (e.g. "Export to link") */
export const SCENE_ACCESS_CHANGED = "scene-access-changed";

const UnlinkIcon = (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71M8 2v3M2 8h3M16 22v-3M22 16h-3" />
  </svg>
);

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
  const [busy, setBusy] = useState(false);
  const notify = useComments()?.notify ?? (() => {});

  // the scene gets its id on its first save
  useEffect(
    () =>
      serverData.subscribe(() =>
        setSceneId(serverData.getSceneInfo()?.id ?? null),
      ),
    [],
  );

  const reload = useCallback(async () => {
    if (!sceneId) {
      return;
    }
    try {
      setAccess((await api.getSceneAccess(sceneId)).access);
      setError("");
    } catch (err: any) {
      setError(err.message);
    }
  }, [sceneId]);

  useEffect(() => {
    reload();
    window.addEventListener(SCENE_ACCESS_CHANGED, reload);
    return () => window.removeEventListener(SCENE_ACCESS_CHANGED, reload);
  }, [reload]);

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

  const shareLink = access.share_token
    ? `${window.location.origin}/share/${access.share_token}`
    : null;

  const setLinkSharing = async (on: boolean) => {
    if (
      !on &&
      !window.confirm(
        "Stop sharing this scene by link? The current link stops working; sharing again creates a new one.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      if (on) {
        await serverData.flush();
        await api.shareScene(sceneId);
      } else {
        await api.unshareScene(sceneId);
      }
      await reload();
      notify(on ? "Share link created" : "Link sharing stopped");
    } catch (err: any) {
      notify(err.message);
    } finally {
      setBusy(false);
    }
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

      {shareLink ? (
        <div className="app-users-panel__row">
          <span className="app-users-panel__icon">{LinkIcon}</span>
          <span className="app-users-panel__who">
            <b>Anyone with the link</b>
            <small {...tooltip("Can open a read-only view", true)}>
              Can view
            </small>
          </span>
          <button
            type="button"
            className="app-users-panel__action"
            aria-label="Copy link"
            {...tooltip("Copy link")}
            onClick={() =>
              navigator.clipboard
                .writeText(shareLink)
                .then(() => notify("Share link copied"))
                .catch(() => notify(shareLink))
            }
          >
            {copyIcon}
          </button>
          <button
            type="button"
            className="app-users-panel__action is-danger"
            aria-label="Stop sharing"
            disabled={busy}
            {...tooltip("Stop sharing")}
            onClick={() => setLinkSharing(false)}
          >
            {UnlinkIcon}
          </button>
        </div>
      ) : (
        <div className="app-users-panel__row">
          <span className="app-users-panel__icon is-off">{LinkIcon}</span>
          <span className="app-users-panel__who">
            <b>Link sharing is off</b>
            <small>Only the people below</small>
          </span>
          <button
            type="button"
            className="app-users-panel__link-button"
            disabled={busy}
            onClick={() => setLinkSharing(true)}
          >
            Create link
          </button>
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
