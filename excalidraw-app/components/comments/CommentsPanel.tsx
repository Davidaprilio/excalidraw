import { useCallback, useRef, useState } from "react";

import api from "../../data/api";
import { useOptionalAuth } from "../../auth/AuthContext";
import { Avatar, timeAgo, useDismiss } from "../dashboard/ui";

import {
  authorAvatar,
  CheckCircleIcon,
  commentLink,
  FilterIcon,
  MiniMenu,
  SearchIcon,
  tooltip,
} from "./CommentParts";
import { useComments } from "./CommentsContext";

import type { CommentThread } from "../../data/api";

type Filter = "open" | "resolved" | "all";

const FILTERS: [Filter, string][] = [
  ["open", "Open"],
  ["resolved", "Resolved"],
  ["all", "All comments"],
];

/** Content of the right sidebar's Comments tab (self-hosted) */
export function CommentsPanel() {
  const comments = useComments();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("open");

  if (!comments) {
    return null;
  }

  const q = query.trim().toLowerCase();
  const shown = comments.threads
    .filter((t) =>
      filter === "all"
        ? true
        : filter === "open"
        ? !t.resolved_at
        : !!t.resolved_at,
    )
    .filter(
      (t) =>
        !q ||
        t.comments.some(
          (c) =>
            c.body.toLowerCase().includes(q) ||
            (c.author_name ?? "").toLowerCase().includes(q),
        ),
    )
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return (
    <div className="app-comments-panel">
      <label className="app-comments-panel__search">
        <SearchIcon />
        <input
          value={query}
          placeholder="Search comments"
          aria-label="Search comments"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="app-comments-panel__tools">
        <FilterMenu filter={filter} onChange={setFilter} />
        {filter !== "open" && (
          <span className="app-comments-panel__filter-label">
            {FILTERS.find(([value]) => value === filter)![1]}
          </span>
        )}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          text={
            !comments.sceneId
              ? "Draw something first to start commenting."
              : q
              ? "No comments match your search."
              : comments.threads.length === 0
              ? "This scene has no comments yet."
              : filter === "resolved"
              ? "No resolved comments."
              : "No open comments."
          }
        />
      ) : (
        <ul className="app-comments-panel__list">
          {shown.map((thread) => (
            <ThreadItem key={thread.id} thread={thread} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterMenu({
  filter,
  onChange,
}: {
  filter: Filter;
  onChange: (filter: Filter) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, close, open);
  return (
    <div ref={ref} className="app-cm-menu">
      <button
        type="button"
        className={`app-cm-icon-button${filter !== "open" ? " is-active" : ""}`}
        aria-label="Filter comments"
        {...tooltip("Filter comments")}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <FilterIcon />
      </button>
      {open && (
        <div className="app-cm-menu__list is-left" role="menu">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={filter === value}
              onClick={() => {
                onChange(value);
                setOpen(false);
              }}
            >
              <span className="app-cm-menu__check">
                {filter === value ? "✓" : ""}
              </span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ThreadItem({ thread }: { thread: CommentThread }) {
  const comments = useComments()!;
  const userId = useOptionalAuth()?.user?.id;
  const first = thread.comments[0];
  const replies = thread.comments.length - 1;
  const sceneId = comments.sceneId!;

  const open = () => {
    comments.select(thread.id);
    comments.scrollToThread(thread);
  };

  return (
    <li
      className={`app-cm-item${
        thread.id === comments.selectedId ? " is-selected" : ""
      }${thread.resolved_at ? " is-resolved" : ""}`}
    >
      <div className="app-cm-item__top">
        <Avatar
          name={first?.author_name || "?"}
          size="app-cm-avatar app-cm-avatar--ring"
          src={authorAvatar(first)}
        />
        <div className="app-cm-item__actions">
          <MiniMenu
            items={[
              {
                label: "Copy link",
                onSelect: () =>
                  navigator.clipboard
                    .writeText(commentLink(sceneId, thread.id))
                    .then(() => comments.notify("Link to comment copied"))
                    .catch(() => {}),
              },
              ...(thread.created_by === userId
                ? [
                    {
                      label: "Delete thread",
                      danger: true,
                      onSelect: async () => {
                        if (window.confirm("Delete this comment thread?")) {
                          await api.deleteThread(sceneId, thread.id);
                          comments.applyThread(thread.id, null);
                        }
                      },
                    },
                  ]
                : []),
            ]}
          />
          <button
            type="button"
            className={`app-cm-icon-button${
              thread.resolved_at ? " is-active" : ""
            }`}
            aria-label={thread.resolved_at ? "Reopen" : "Resolve"}
            {...tooltip(thread.resolved_at ? "Reopen" : "Resolve")}
            onClick={async () => {
              const res = await api.updateThread(sceneId, thread.id, {
                resolved: !thread.resolved_at,
              });
              if (!thread.resolved_at && comments.selectedId === thread.id) {
                comments.select(null);
              }
              comments.applyThread(thread.id, res.thread);
            }}
          >
            <CheckCircleIcon />
          </button>
        </div>
      </div>
      <button type="button" className="app-cm-item__main" onClick={open}>
        <span className="app-cm-item__meta">
          <b>{first?.author_name ?? "Deleted user"}</b> •{" "}
          {timeAgo(first?.created_at ?? thread.created_at)}
        </span>
        <span className="app-cm-item__body">{first?.body}</span>
        {replies > 0 && (
          <span className="app-cm-item__replies">
            {replies} {replies === 1 ? "reply" : "replies"}
          </span>
        )}
      </button>
    </li>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="app-comments-panel__empty">
      {/* sad speech bubble + "..." bubble, drawn in Excalidraw's sketchy style */}
      <svg
        viewBox="0 0 300 200"
        aria-hidden
        className="app-comments-panel__art"
      >
        <path
          d="M28 22 L196 16 L190 128 L96 130 L72 168 L70 132 L34 134 Z"
          fill="currentColor"
          opacity="0.18"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx="84" cy="62" r="7" fill="currentColor" opacity="0.6" />
        <circle cx="136" cy="60" r="7" fill="currentColor" opacity="0.6" />
        <path
          d="M78 104 Q110 76 142 102"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path
          d="M182 70 L282 66 L278 150 L236 150 L244 184 L214 152 L186 152 Z"
          fill="currentColor"
          opacity="0.12"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="6 6"
          strokeLinejoin="round"
        />
        <circle cx="216" cy="110" r="4" fill="currentColor" opacity="0.5" />
        <circle cx="232" cy="110" r="4" fill="currentColor" opacity="0.5" />
        <circle cx="248" cy="110" r="4" fill="currentColor" opacity="0.5" />
      </svg>
      <p className="excalifont">{text}</p>
    </div>
  );
}
