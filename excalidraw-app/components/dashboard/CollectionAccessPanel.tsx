import { useCallback, useEffect, useState } from "react";

import api from "../../data/api";
import { useAuth } from "../../auth/AuthContext";
import { usePeopleSearch } from "../usePeopleSearch";

import { CloseIcon, FolderIcon, LockIcon, UsersIcon } from "./icons";
import { Avatar, Button, useToast } from "./ui";

import type {
  Collection,
  CollectionAccess,
  CollectionRole,
  InvitePerson,
  Workspace,
} from "../../data/api";

const ROLE_LABELS: Record<CollectionRole, string> = {
  view: "Can view",
  edit: "Can edit",
  manage: "Can manage",
};
const ROLES = Object.keys(ROLE_LABELS) as CollectionRole[];

const selectClass =
  "rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:opacity-50";

/** What the panel needs to know about the collection's workspace */
export type PanelWorkspace = Pick<
  Workspace,
  "id" | "name" | "avatar_version" | "member_count"
>;

type Team = Pick<Workspace, "id" | "name" | "avatar_version" | "member_count">;

type InviteOption =
  | ({ kind: "person" } & InvitePerson)
  | ({ kind: "team" } & Team);

/**
 * Who can open a collection:
 *  - private: its owner and people added from its workspace
 *  - workspace (public): everyone in its workspace with one role, plus people
 *    and other teams (workspaces) added, from anywhere
 * For people who can manage the collection (guests included).
 */
export function CollectionAccessPanel({
  workspace,
  collection,
  myWorkspaces,
  onChanged,
}: {
  workspace: PanelWorkspace;
  collection: Collection;
  /** teams I can share it with: the workspaces I belong to */
  myWorkspaces: Team[];
  /** the collection itself changed (visibility, link...) */
  onChanged: () => Promise<void>;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [access, setAccess] = useState<CollectionAccess | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const res = await api.getCollectionAccess(workspace.id, collection.id);
    setAccess(res.access);
  }, [workspace.id, collection.id]);

  useEffect(() => {
    reload().catch((err) => toast(err.message));
    // the collection's visibility/owner may change from the rest of the page
  }, [reload, toast, collection.visibility, collection.owner_id]);

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await action();
      await reload();
      toast(message);
    } catch (err: any) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!access) {
    return (
      <PanelFrame>
        <p className="text-sm text-gray-500">Loading...</p>
      </PanelFrame>
    );
  }

  const isPrivate = access.visibility === "private";
  const hasOutsiders =
    access.teams.length > 0 || access.members.some((m) => m.guest);
  const teamOptions = isPrivate
    ? []
    : myWorkspaces.filter(
        (w) =>
          w.id !== workspace.id && !access.teams.some((t) => t.id === w.id),
      );

  const setVisibility = (value: CollectionRole | "none") => {
    const warnings = [
      collection.share_token && "its share link stops working",
      hasOutsiders &&
        `people and teams outside ${workspace.name} lose their access`,
    ].filter(Boolean);
    if (
      value === "none" &&
      warnings.length &&
      !window.confirm(`Make this collection private? ${warnings.join("; ")}.`)
    ) {
      return;
    }
    run(
      async () => {
        await api.updateCollection(
          workspace.id,
          collection.id,
          value === "none"
            ? { visibility: "private" }
            : { visibility: "workspace", workspaceRole: value },
        );
        await onChanged();
      },
      value === "none"
        ? "Only the people added can open it now"
        : `Everyone in ${workspace.name}: ${ROLE_LABELS[value].toLowerCase()}`,
    );
  };

  const invite = (option: InviteOption, role: CollectionRole) =>
    run(
      () =>
        option.kind === "team"
          ? api.setCollectionTeam(workspace.id, collection.id, option.id, role)
          : api.setCollectionMember(
              workspace.id,
              collection.id,
              option.id,
              role,
            ),
      `${
        option.kind === "team" ? option.name : option.name || option.email
      } added`,
    );

  return (
    <PanelFrame>
      {/* private (people added) or the workspace (its team) and beyond */}
      <div
        role="radiogroup"
        aria-label="Visibility"
        className="grid grid-cols-2 gap-2"
      >
        {(
          [
            {
              value: "private",
              icon: <LockIcon />,
              title: "Private",
              text: `Only people added, from ${workspace.name}`,
            },
            {
              value: "workspace",
              icon: <FolderIcon />,
              title: "Workspace",
              text: `Everyone in ${workspace.name}, and anyone you add`,
            },
          ] as const
        ).map((option) => {
          const selected = isPrivate === (option.value === "private");
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={busy}
              onClick={() =>
                !selected &&
                setVisibility(
                  option.value === "private" ? "none" : access.workspace_role,
                )
              }
              className={`flex cursor-pointer flex-col items-start gap-1 rounded-lg border p-3 text-left transition disabled:cursor-not-allowed ${
                selected
                  ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <span
                className={`flex items-center gap-2 text-sm font-medium ${
                  selected ? "text-indigo-700" : "text-gray-900"
                }`}
              >
                {option.icon}
                {option.title}
              </span>
              <span className="text-xs text-gray-500">{option.text}</span>
            </button>
          );
        })}
      </div>

      {/* its own workspace = one team, with one role for everyone in it */}
      {!isPrivate && (
        <div className="mt-4 flex items-center gap-3">
          <Avatar
            name={workspace.name}
            size="h-9 w-9 text-sm"
            src={api.workspaceAvatarUrl(workspace.id, workspace.avatar_version)}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              Everyone in {workspace.name}
            </p>
            <p className="text-xs text-gray-500">
              This workspace · {workspace.member_count} member
              {workspace.member_count === 1 ? "" : "s"}
            </p>
          </div>
          <select
            aria-label="Team access"
            value={access.workspace_role}
            disabled={busy}
            onChange={(event) =>
              setVisibility(event.target.value as CollectionRole)
            }
            className={selectClass}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
      )}

      <InviteForm
        placeholder={
          isPrivate
            ? `Add people from ${workspace.name}`
            : "Add people or teams, from any workspace"
        }
        search={(q) => api.collectionPeople(workspace.id, collection.id, q)}
        teams={teamOptions}
        busy={busy}
        onInvite={invite}
      />

      {access.teams.length > 0 && (
        <>
          <SectionTitle>Teams</SectionTitle>
          <ul className="flex flex-col gap-1">
            {access.teams.map((team) => (
              <Row
                key={team.id}
                avatar={
                  <Avatar
                    name={team.name}
                    size="h-8 w-8 text-xs"
                    src={api.workspaceAvatarUrl(team.id, team.avatar_version)}
                  />
                }
                title={team.name}
                subtitle={`Team · ${team.member_count} member${
                  team.member_count === 1 ? "" : "s"
                }`}
                action={
                  <RoleControls
                    label={team.name}
                    role={team.role}
                    busy={busy}
                    onRole={(role) =>
                      run(
                        () =>
                          api.setCollectionTeam(
                            workspace.id,
                            collection.id,
                            team.id,
                            role,
                          ),
                        "Role updated",
                      )
                    }
                    onRemove={() =>
                      run(
                        () =>
                          api.removeCollectionTeam(
                            workspace.id,
                            collection.id,
                            team.id,
                          ),
                        `${team.name} removed`,
                      )
                    }
                  />
                }
              />
            ))}
          </ul>
        </>
      )}

      <SectionTitle>People with access</SectionTitle>
      <ul className="flex flex-col gap-1">
        {access.owner && (
          <Row
            avatar={<PersonAvatar person={access.owner} />}
            title={
              <>
                {access.owner.name || access.owner.email}
                {access.owner.id === user?.id && <You />}
              </>
            }
            subtitle={access.owner.email}
            action={
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                Owner
              </span>
            }
          />
        )}
        {access.members.map((member) => (
          <Row
            key={member.id}
            avatar={<PersonAvatar person={member} />}
            title={
              <>
                {member.name || member.email}
                {member.id === user?.id && <You />}
                {member.guest && <GuestBadge />}
              </>
            }
            subtitle={member.email}
            action={
              <RoleControls
                label={member.name || member.email}
                role={member.role}
                busy={busy}
                onRole={(role) =>
                  run(
                    () =>
                      api.setCollectionMember(
                        workspace.id,
                        collection.id,
                        member.id,
                        role,
                      ),
                    "Role updated",
                  )
                }
                onRemove={() =>
                  run(
                    () =>
                      api.removeCollectionMember(
                        workspace.id,
                        collection.id,
                        member.id,
                      ),
                    `${member.name || member.email} removed`,
                  )
                }
              />
            }
          />
        ))}
      </ul>

      <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2.5 text-xs leading-relaxed text-gray-500">
        {isPrivate
          ? `Private: only the owner and the people above, all from ${workspace.name}, can open it. It can't be shared outside ${workspace.name} or by link.`
          : `Everyone in ${workspace.name} gets "${ROLE_LABELS[
              access.workspace_role
            ].toLowerCase()}". People and teams above get their own role, even from other workspaces; nobody else outside ${
              workspace.name
            } has access.`}
      </p>
    </PanelFrame>
  );
}

function PanelFrame({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
        <UsersIcon />
        Access
      </h2>
      {children}
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
      {children}
    </h3>
  );
}

const You = () => <span className="font-normal text-gray-500"> (you)</span>;

const GuestBadge = () => (
  <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 align-middle text-[10px] font-medium text-amber-800">
    Guest
  </span>
);

function PersonAvatar({
  person,
}: {
  person: {
    id: string;
    name: string | null;
    email: string;
    avatar_version: string | null;
  };
}) {
  return (
    <Avatar
      name={person.name || person.email}
      size="h-8 w-8 text-xs"
      src={api.avatarUrl(person.id, person.avatar_version)}
    />
  );
}

function Row({
  avatar,
  title,
  subtitle,
  action,
}: {
  avatar: React.ReactNode;
  title: React.ReactNode;
  subtitle: string;
  action: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg py-1.5">
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{title}</p>
        <p className="truncate text-xs text-gray-500">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">{action}</div>
    </li>
  );
}

function RoleControls({
  label,
  role,
  busy,
  onRole,
  onRemove,
}: {
  label: string;
  role: CollectionRole;
  busy: boolean;
  onRole: (role: CollectionRole) => void;
  onRemove: () => void;
}) {
  return (
    <>
      <select
        aria-label={`Role of ${label}`}
        value={role}
        disabled={busy}
        onChange={(event) => onRole(event.target.value as CollectionRole)}
        className={selectClass}
      >
        {ROLES.map((value) => (
          <option key={value} value={value}>
            {ROLE_LABELS[value]}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label={`Remove ${label}`}
        disabled={busy}
        onClick={onRemove}
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
      >
        <CloseIcon />
      </button>
    </>
  );
}

/** Pick a person (found by name or email) or a team, and a role */
function InviteForm({
  placeholder,
  search,
  teams,
  busy,
  onInvite,
}: {
  placeholder: string;
  search: (q: string) => Promise<{ users: InvitePerson[] }>;
  /** teams that can be added (empty when private) */
  teams: Team[];
  busy: boolean;
  onInvite: (option: InviteOption, role: CollectionRole) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<InviteOption | null>(null);
  const [role, setRole] = useState<CollectionRole>("edit");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const people = usePeopleSearch(query, search, !picked);

  const q = query.trim().toLowerCase();
  const options: InviteOption[] = picked
    ? []
    : [
        ...teams
          .filter((team) => !q || team.name.toLowerCase().includes(q))
          .map((team) => ({ kind: "team" as const, ...team })),
        ...people.map((person) => ({ kind: "person" as const, ...person })),
      ].slice(0, 10);

  const pick = (option: InviteOption) => {
    setPicked(option);
    setQuery(
      option.kind === "team" ? option.name : option.name || option.email,
    );
    setOpen(false);
  };
  const showList = open && options.length > 0;

  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="relative">
        <input
          value={query}
          role="combobox"
          aria-label="Add people or teams"
          aria-expanded={showList}
          aria-controls="collection-invite-options"
          autoComplete="off"
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setPicked(null);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (!showList) {
              return;
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const step = event.key === "ArrowDown" ? 1 : -1;
              setActive((active + step + options.length) % options.length);
            } else if (event.key === "Enter") {
              event.preventDefault();
              pick(options[active]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        {showList && (
          <ul
            id="collection-invite-options"
            role="listbox"
            className="absolute top-full right-0 left-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            {options.map((option, index) => (
              <li
                key={`${option.kind}-${option.id}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(option);
                }}
                onMouseEnter={() => setActive(index)}
                className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 ${
                  index === active ? "bg-indigo-50" : ""
                }`}
              >
                {option.kind === "team" ? (
                  <Avatar
                    name={option.name}
                    size="h-6 w-6 text-[10px]"
                    src={api.workspaceAvatarUrl(
                      option.id,
                      option.avatar_version,
                    )}
                  />
                ) : (
                  <Avatar
                    name={option.name || option.email}
                    size="h-6 w-6 text-[10px]"
                    src={api.avatarUrl(option.id, option.avatar_version)}
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-gray-900">
                    {option.kind === "team"
                      ? option.name
                      : option.name || option.email}
                    {option.kind === "person" && option.guest && <GuestBadge />}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {option.kind === "team"
                      ? `Team · ${option.member_count} member${
                          option.member_count === 1 ? "" : "s"
                        }`
                      : option.email}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex gap-2">
        <select
          aria-label="Role for the invite"
          value={role}
          onChange={(event) => setRole(event.target.value as CollectionRole)}
          className={`${selectClass} flex-1`}
        >
          {ROLES.map((value) => (
            <option key={value} value={value}>
              {ROLE_LABELS[value]}
            </option>
          ))}
        </select>
        <Button
          variant="primary"
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
        </Button>
      </div>
    </div>
  );
}
