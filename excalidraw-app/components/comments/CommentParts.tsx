import { useCallback, useEffect, useRef, useState } from "react";

import api from "../../data/api";
import { useOptionalAuth } from "../../auth/AuthContext";
import { Avatar, timeAgo, useDismiss } from "../dashboard/ui";

import type { CommentThread, SceneComment } from "../../data/api";
import type { ReactNode, SVGProps } from "react";

// ---- Icons (16px, stroke = currentColor) ----

const icon = (paths: ReactNode) => (props: SVGProps<SVGSVGElement>) =>
  (
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
      {...props}
    >
      {paths}
    </svg>
  );

export const CommentIcon = icon(
  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
);
export const CheckCircleIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </>,
);
export const LinkIcon = icon(
  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />,
);
export const TrashIcon = icon(
  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />,
);
export const CloseIcon = icon(<path d="M18 6 6 18M6 6l12 12" />);
export const KebabIcon = icon(
  <>
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="19" r="1" />
  </>,
);
export const SmileIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
  </>,
);
export const SendIcon = icon(<path d="M12 19V5M5 12l7-7 7 7" />);
export const SearchIcon = icon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </>,
);
export const FilterIcon = icon(
  <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
);

// ---- Helpers ----

export const commentLink = (sceneId: string, threadId: string) =>
  `${window.location.origin}/s/${sceneId}?comment=${threadId}`;

export const authorAvatar = (comment?: SceneComment) =>
  comment?.author_id
    ? api.avatarUrl(comment.author_id, comment.author_avatar_version)
    : null;

// ---- Links in comment text ----

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
// punctuation that usually ends the sentence, not the link
const TRAILING_RE = /[.,;:!?)\]}'"]+$/;

/** Comment text with its URLs as links (text stays text: React escapes it) */
export function LinkifiedText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const raw = match[0];
    const url = raw.replace(TRAILING_RE, "");
    const start = match.index!;
    parts.push(text.slice(last, start));
    parts.push(
      <a
        key={start}
        href={url.startsWith("www.") ? `https://${url}` : url}
        target="_blank"
        rel="noopener noreferrer"
        className="app-cm-link"
      >
        {url}
      </a>,
    );
    last = start + url.length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

// ---- Emoji picker ----

const EMOJIS = [
  "👍",
  "👎",
  "😀",
  "😂",
  "😍",
  "🎉",
  "🙏",
  "👏",
  "🔥",
  "❤️",
  "😮",
  "😢",
  "🤔",
  "👀",
  "✅",
  "❌",
  "🚀",
  "💡",
  "⭐",
  "💯",
  "🙌",
  "😅",
  "😎",
  "🤝",
];

type FixedPosition = { top: number; left: number };

// Popovers are position: fixed next to their button, so the scrolling
// comment list can't clip them
const EMOJI_GRID = { width: 272, height: 112 };

const popoverBelowOrAbove = (
  button: HTMLElement,
  size: { width: number; height: number },
  align: "left" | "right",
): FixedPosition => {
  const rect = button.getBoundingClientRect();
  const top =
    rect.top - size.height - 6 > 8
      ? rect.top - size.height - 6
      : rect.bottom + 6;
  const left = align === "left" ? rect.left : rect.right - size.width;
  return {
    top,
    left: Math.min(Math.max(8, left), window.innerWidth - size.width - 8),
  };
};

export function EmojiButton({
  onPick,
  label = "Add emoji",
}: {
  onPick: (emoji: string) => void;
  label?: string;
}) {
  const [position, setPosition] = useState<FixedPosition | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setPosition(null), []);
  useDismiss(ref, close, !!position);
  return (
    <div ref={ref} className="app-cm-emoji">
      <button
        type="button"
        className="app-cm-icon-button"
        aria-label={label}
        title={label}
        aria-expanded={!!position}
        onClick={(event) =>
          setPosition(
            position
              ? null
              : popoverBelowOrAbove(event.currentTarget, EMOJI_GRID, "left"),
          )
        }
      >
        <SmileIcon />
      </button>
      {position && (
        <div className="app-cm-emoji__grid" role="menu" style={position}>
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="menuitem"
              onClick={() => {
                setPosition(null);
                onPick(emoji);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Menu (⋮) ----

const MENU_WIDTH = 160;

export function MiniMenu({
  items,
  label = "More actions",
}: {
  items: { label: string; onSelect: () => void; danger?: boolean }[];
  label?: string;
}) {
  const [position, setPosition] = useState<FixedPosition | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setPosition(null), []);
  useDismiss(ref, close, !!position);
  const open = !!position;
  if (!items.length) {
    return null;
  }
  return (
    <div ref={ref} className="app-cm-menu">
      <button
        type="button"
        className="app-cm-icon-button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          setPosition(
            open
              ? null
              : {
                  top: rect.bottom + 4,
                  left: Math.max(8, rect.right - MENU_WIDTH),
                },
          );
        }}
      >
        <KebabIcon />
      </button>
      {open && (
        <div className="app-cm-menu__list" role="menu" style={position}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.danger ? "is-danger" : undefined}
              onClick={(event) => {
                event.stopPropagation();
                setPosition(null);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Composer: text + emoji + send (Enter sends, Shift+Enter = new line) ----

export function Composer({
  placeholder,
  initial = "",
  autoFocus,
  submitLabel = "Send",
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  initial?: string;
  autoFocus?: boolean;
  submitLabel?: string;
  onSubmit: (body: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);

  // grow with the text
  useEffect(() => {
    const el = textarea.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
    }
  }, [body]);

  const submit = async () => {
    if (!body.trim() || busy) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSubmit(body.trim());
      setBody("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-cm-composer">
      <textarea
        ref={textarea}
        autoFocus={autoFocus}
        rows={1}
        aria-label={placeholder}
        placeholder={placeholder}
        value={body}
        maxLength={5000}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          // keep Excalidraw's shortcuts out of the text box (Escape still
          // bubbles up to close the popup unless this composer handles it)
          if (event.key !== "Escape" || onCancel) {
            event.stopPropagation();
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          } else if (event.key === "Escape" && onCancel) {
            onCancel();
          }
        }}
      />
      <div className="app-cm-composer__bar">
        <EmojiButton
          onPick={(emoji) => {
            setBody((text) => text + emoji);
            textarea.current?.focus();
          }}
        />
        {onCancel && initial && (
          <button
            type="button"
            className="app-cm-text-button"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          className="app-cm-send"
          aria-label={submitLabel}
          title={`${submitLabel} (Enter)`}
          disabled={!body.trim() || busy}
          onClick={submit}
        >
          <SendIcon />
        </button>
      </div>
      {error && <p className="app-cm-error">{error}</p>}
    </div>
  );
}

// ---- One comment in a thread ----

export function CommentItem({
  sceneId,
  thread,
  comment,
  onThread,
}: {
  sceneId: string;
  thread: CommentThread;
  comment: SceneComment;
  onThread: (thread: CommentThread | null) => void;
}) {
  const userId = useOptionalAuth()?.user?.id;
  const [editing, setEditing] = useState(false);
  const mine = comment.author_id === userId;

  const react = async (emoji: string) =>
    onThread(
      (await api.toggleReaction(sceneId, thread.id, comment.id, emoji)).thread,
    );

  return (
    <div className="app-cm-comment">
      <div className="app-cm-comment__header">
        <Avatar
          name={comment.author_name || "?"}
          size="app-cm-avatar"
          src={authorAvatar(comment)}
        />
        <span className="app-cm-comment__author">
          {comment.author_name ?? "Deleted user"}
        </span>
        <span className="app-cm-comment__time">
          • {timeAgo(comment.created_at)}
          {comment.edited_at && " (edited)"}
        </span>
        {mine && (
          <MiniMenu
            items={[
              { label: "Edit", onSelect: () => setEditing(true) },
              {
                label: "Delete",
                danger: true,
                onSelect: async () => {
                  if (window.confirm("Delete this comment?")) {
                    onThread(
                      (await api.deleteComment(sceneId, thread.id, comment.id))
                        .thread,
                    );
                  }
                },
              },
            ]}
          />
        )}
      </div>
      {editing ? (
        <Composer
          autoFocus
          placeholder="Edit comment"
          submitLabel="Save"
          initial={comment.body}
          onCancel={() => setEditing(false)}
          onSubmit={async (body) => {
            onThread(
              (await api.editComment(sceneId, thread.id, comment.id, body))
                .thread,
            );
            setEditing(false);
          }}
        />
      ) : (
        <p className="app-cm-comment__body">
          <LinkifiedText text={comment.body} />
        </p>
      )}
      <div className="app-cm-reactions">
        {comment.reactions.map((reaction) => (
          <button
            key={reaction.emoji}
            type="button"
            className={`app-cm-reaction${reaction.mine ? " is-mine" : ""}`}
            aria-pressed={reaction.mine}
            onClick={() => react(reaction.emoji)}
          >
            {reaction.emoji} {reaction.count}
          </button>
        ))}
        <EmojiButton label="Add reaction" onPick={react} />
      </div>
    </div>
  );
}
