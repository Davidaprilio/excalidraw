import {
  CloseIcon,
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
import { usePeopleSearch } from "./usePeopleSearch";

import "./SceneUsersPanel.scss";

import type {
  CollectionRole,
  InvitePerson,
  SceneAccess,
  SceneAccessUser,
} from "../data/api";

const ROLES: CollectionRole[] = ["view", "edit", "manage"];

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
  manage: {
    label: "Can manage",
    details: "Can edit, share it and manage its collection's access",
  },
  edit: {
    label: "Can edit",
    details: "Can edit, comment and share it",
  },
  view: {
    label: "Can view",
    details: "Can open it read-only and comment",
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

  const setAllowSave = async (allowSave: boolean) => {
    setBusy(true);
    // tick at once; the reload below brings the server's value back
    setAccess({ ...access, share_allow_save: allowSave });
    try {
      await api.setSceneShareAllowSave(sceneId, allowSave);
      notify(
        allowSave
          ? "Viewers can save a copy"
          : "Viewers can no longer save a copy",
      );
    } catch (err: any) {
      notify(err.message);
    } finally {
      await reload();
      setBusy(false);
    }
  };

  const shared = access.collection?.visibility === "workspace";
  // a private collection (not someone's own Private one) can't be shared by link
  const linkAllowed = shared || !!access.collection?.is_personal;
  // viewers can't change the link; managers invite people
  const canEdit = access.my_level >= 2;
  const canManage = access.my_level >= 3;
  const meGuest = !!access.users.find((u) => u.id === userId)?.guest;

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await action();
      await reload();
      notify(message);
    } catch (err: any) {
      notify(err.message);
    } finally {
      setBusy(false);
    }
  };

  const setMember = (
    person: { id: string; name: string | null; email: string },
    role: CollectionRole | null,
  ) =>
    run(
      () =>
        role
          ? api.setSceneMember(sceneId, person.id, role)
          : api.removeSceneMember(sceneId, person.id),
      role
        ? `${person.name || person.email}: ${ACCESS[role].label.toLowerCase()}`
        : `${person.name || person.email} removed`,
    );

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
            Only the people below can open this scene: it's in the private
            collection{" "}
            {access.collection ? <b>{access.collection.name}</b> : null}.
            {!linkAllowed && " It can't be shared by link."}
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
          {canEdit && (
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
          )}
        </div>
      ) : null}
      {shareLink && canEdit && (
        <label className="app-users-panel__option">
          <input
            type="checkbox"
            checked={access.share_allow_save}
            disabled={busy}
            onChange={(event) => setAllowSave(event.target.checked)}
          />
          <span>
            Allow saving a copy
            <small>"Save to..." in the viewer's menu</small>
          </span>
        </label>
      )}
      {!shareLink && linkAllowed && canEdit && (
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

      {canManage && (
        <SceneInviteForm
          sceneId={sceneId}
          guestsAllowed={access.guests_allowed}
          busy={busy}
          onInvite={(person, role) => setMember(person, role)}
        />
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
                {user.guest && (
                  <span
                    className="app-users-panel__guest"
                    {...tooltip(
                      `Not in ${access.workspace.name}: invited to this scene or its collection`,
                      true,
                    )}
                  >
                    Guest
                  </span>
                )}
              </b>
              <small>{user.email}</small>
            </span>
            {canManage && user.direct_role && user.access !== "owner" ? (
              <>
                <select
                  className="app-users-panel__select"
                  aria-label={`Role of ${user.name || user.email}`}
                  value={user.direct_role}
                  disabled={busy}
                  onChange={(event) =>
                    setMember(user, event.target.value as CollectionRole)
                  }
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ACCESS[role].label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="app-users-panel__action is-danger"
                  aria-label={`Remove ${user.name || user.email}`}
                  disabled={busy}
                  {...tooltip("Remove from this scene")}
                  onClick={() => setMember(user, null)}
                >
                  {CloseIcon}
                </button>
              </>
            ) : (
              <span
                className={`app-users-panel__badge is-${user.access}`}
                {...tooltip(ACCESS[user.access].details, true)}
              >
                {ACCESS[user.access].label}
              </span>
            )}
          </li>
        ))}
      </ul>

      {!meGuest && (
        <div className="app-users-panel__footer">
          <p>Collection and workspace access are managed from the dashboard.</p>
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
      )}
    </div>
  );
}

/** Invite someone to this scene: search by name or email, pick a role */
function SceneInviteForm({
  sceneId,
  guestsAllowed,
  busy,
  onInvite,
}: {
  sceneId: string;
  guestsAllowed: boolean;
  busy: boolean;
  onInvite: (person: InvitePerson, role: CollectionRole) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<InvitePerson | null>(null);
  const [role, setRole] = useState<CollectionRole>("edit");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const people = usePeopleSearch(
    query,
    (q) => api.scenePeople(sceneId, q),
    !picked,
  );
  const showList = open && !picked && people.length > 0;

  const pick = (person: InvitePerson) => {
    setPicked(person);
    setQuery(person.name || person.email);
    setOpen(false);
  };

  return (
    <div className="app-users-panel__invite">
      <div className="app-users-panel__combo">
        <input
          value={query}
          role="combobox"
          aria-label="Invite people"
          aria-expanded={showList}
          aria-controls="scene-invite-options"
          autoComplete="off"
          placeholder={
            guestsAllowed
              ? "Invite people by name or email"
              : "Invite people from this workspace"
          }
          onChange={(event) => {
            setQuery(event.target.value);
            setPicked(null);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            // the canvas mustn't see these keys
            event.stopPropagation();
            if (!showList) {
              return;
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const step = event.key === "ArrowDown" ? 1 : -1;
              setActive((active + step + people.length) % people.length);
            } else if (event.key === "Enter") {
              event.preventDefault();
              pick(people[active]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {showList && (
          <ul
            id="scene-invite-options"
            role="listbox"
            className="app-users-panel__options"
          >
            {people.map((person, index) => (
              <li
                key={person.id}
                role="option"
                aria-selected={index === active}
                className={index === active ? "is-active" : undefined}
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(person);
                }}
                onMouseEnter={() => setActive(index)}
              >
                <Avatar
                  name={person.name || person.email}
                  size="app-users-panel__avatar is-small"
                  src={api.avatarUrl(person.id, person.avatar_version)}
                />
                <span className="app-users-panel__who">
                  <b>
                    {person.name || person.email}
                    {person.guest && (
                      <span className="app-users-panel__guest">Guest</span>
                    )}
                  </b>
                  <small>{person.email}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="app-users-panel__invite-row">
        <select
          className="app-users-panel__select"
          aria-label="Role for the invite"
          value={role}
          onChange={(event) => setRole(event.target.value as CollectionRole)}
        >
          {ROLES.map((value) => (
            <option key={value} value={value}>
              {ACCESS[value].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="app-users-panel__link-button is-primary"
          disabled={busy || !picked}
          onClick={async () => {
            if (picked) {
              await onInvite(picked, role);
              setPicked(null);
              setQuery("");
            }
          }}
        >
          Invite
        </button>
      </div>
    </div>
  );
}
