import { useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import api from "../../data/api";
import { useOptionalAuth } from "../../auth/AuthContext";
import { Avatar } from "../dashboard/ui";

import {
  authorAvatar,
  CheckCircleIcon,
  CloseIcon,
  CommentItem,
  commentLink,
  Composer,
  LinkIcon,
  TrashIcon,
} from "./CommentParts";
import { useComments } from "./CommentsContext";

import "./Comments.scss";

import type { CommentThread } from "../../data/api";

type Viewport = {
  scrollX: number;
  scrollY: number;
  zoom: number;
  offsetLeft: number;
  offsetTop: number;
  width: number;
  height: number;
};

const readViewport = (
  appState: ReturnType<ExcalidrawImperativeAPI["getAppState"]>,
): Viewport => ({
  scrollX: appState.scrollX,
  scrollY: appState.scrollY,
  zoom: appState.zoom.value,
  offsetLeft: appState.offsetLeft,
  offsetTop: appState.offsetTop,
  width: appState.width,
  height: appState.height,
});

const sameViewport = (a: Viewport | null, b: Viewport) =>
  !!a && (Object.keys(b) as (keyof Viewport)[]).every((k) => a[k] === b[k]);

const PIN = 34;
const POPUP_WIDTH = 340;

/** Where a popup next to a pin goes: right of it, or left when there's no room */
const popupPosition = (pin: { left: number; top: number }) => {
  const right = pin.left + PIN + 10;
  const left =
    right + POPUP_WIDTH > window.innerWidth - 8
      ? Math.max(8, pin.left - POPUP_WIDTH - 10)
      : right;
  const top = Math.min(
    Math.max(8, pin.top - PIN - 8),
    window.innerHeight - 260,
  );
  // never past the bottom of the window: the comment list scrolls instead
  const maxHeight = Math.min(560, window.innerHeight - top - 8);
  return { left, top, maxHeight };
};

/**
 * Over the canvas: comment pins (following scroll and zoom), the "place a
 * comment" layer, the composer of a new comment and the popup of the open thread.
 */
export function CommentsOverlay({
  excalidrawAPI,
  theme,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  theme: "light" | "dark";
}) {
  const comments = useComments();
  const [viewport, setViewport] = useState<Viewport | null>(null);

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }
    const update = () => {
      const next = readViewport(excalidrawAPI.getAppState());
      setViewport((current) => (sameViewport(current, next) ? current : next));
    };
    update();
    const unsubscribeChange = excalidrawAPI.onChange(update);
    const unsubscribeScroll = excalidrawAPI.onScrollChange(update);
    window.addEventListener("resize", update);
    return () => {
      unsubscribeChange();
      unsubscribeScroll();
      window.removeEventListener("resize", update);
    };
  }, [excalidrawAPI]);

  // Esc leaves "place a comment" mode
  useEffect(() => {
    if (!comments?.placing) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        comments.setPlacing(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [comments]);

  if (!comments?.sceneId || !viewport) {
    return null;
  }
  const { threads, selectedId, placing, draft } = comments;
  const selected = threads.find((t) => t.id === selectedId) ?? null;

  // the pin's tip (bottom-left corner) is the commented point
  const toScreen = (x: number, y: number) => ({
    left: (x + viewport.scrollX) * viewport.zoom + viewport.offsetLeft,
    top: (y + viewport.scrollY) * viewport.zoom + viewport.offsetTop,
  });
  const onCanvas = ({ left, top }: { left: number; top: number }) =>
    left >= viewport.offsetLeft &&
    top >= viewport.offsetTop &&
    left <= viewport.offsetLeft + viewport.width &&
    top <= viewport.offsetTop + viewport.height;

  const visible = threads.filter((t) => !t.resolved_at || t.id === selectedId);

  const themeClass = theme === "dark" ? " theme--dark" : "";

  return (
    <>
      {/* data-prevent-outside-click: using pins/popups must not close
        Excalidraw's (undocked) sidebar */}
      <div
        data-prevent-outside-click
        className={`app-comments-overlay${
          theme === "dark" ? " theme--dark" : ""
        }`}
      >
        {visible.map((thread) => {
          const position = toScreen(thread.x, thread.y);
          if (!onCanvas(position)) {
            return null;
          }
          const first = thread.comments[0];
          return (
            <button
              key={thread.id}
              type="button"
              data-comment-pin
              className={`app-comment-pin${
                thread.id === selectedId ? " is-selected" : ""
              }${thread.resolved_at ? " is-resolved" : ""}`}
              style={position}
              title={first?.body}
              aria-label={`Comment by ${first?.author_name ?? "someone"}: ${
                first?.body ?? ""
              }`}
              onClick={() =>
                comments.select(thread.id === selectedId ? null : thread.id)
              }
            >
              <Avatar
                name={first?.author_name || "?"}
                size="app-comment-pin__avatar"
                src={authorAvatar(first)}
              />
              {thread.comments.length > 1 && (
                <span className="app-comment-pin__count">
                  {thread.comments.length}
                </span>
              )}
            </button>
          );
        })}

        {placing && (
          <div
            className="app-comments-placing"
            style={{
              left: viewport.offsetLeft,
              top: viewport.offsetTop,
              width: viewport.width,
              height: viewport.height,
            }}
            onClick={(event) => {
              comments.select(null);
              comments.setDraft({
                x:
                  (event.clientX - viewport.offsetLeft) / viewport.zoom -
                  viewport.scrollX,
                y:
                  (event.clientY - viewport.offsetTop) / viewport.zoom -
                  viewport.scrollY,
              });
              comments.setPlacing(false);
            }}
          />
        )}
      </div>
      {/* popups: own layer above Excalidraw's UI (toolbars, welcome screen);
          pins stay below it */}
      <div
        data-prevent-outside-click
        className={`app-comments-overlay app-comments-overlay--popups${themeClass}`}
      >
        {draft && (
          <DraftComposer
            pin={toScreen(draft.x, draft.y)}
            onCancel={() => comments.setDraft(null)}
            onSubmit={(body) => comments.createThread(body, draft)}
          />
        )}

        {selected && !draft && (
          <ThreadPopup
            key={selected.id}
            sceneId={comments.sceneId}
            thread={selected}
            pin={toScreen(selected.x, selected.y)}
            onThread={(thread) => comments.applyThread(selected.id, thread)}
            onClose={() => comments.select(null)}
          />
        )}
      </div>
      {placing && (
        // outside the overlay's stacking context so it stays above Excalidraw's UI
        <span
          className={`app-comments-hint${themeClass}`}
          style={{
            top: viewport.offsetTop + 72,
            left: viewport.offsetLeft + viewport.width / 2,
          }}
        >
          Click anywhere to comment · Esc to cancel
        </span>
      )}
    </>
  );
}

function DraftComposer({
  pin,
  onSubmit,
  onCancel,
}: {
  pin: { left: number; top: number };
  onSubmit: (body: string) => Promise<void>;
  onCancel: () => void;
}) {
  const user = useOptionalAuth()?.user;
  return (
    <>
      <span className="app-comment-pin is-draft is-selected" style={pin}>
        <Avatar
          name={user?.name || "?"}
          size="app-comment-pin__avatar"
          src={user ? api.avatarUrl(user.id, user.avatar_version) : null}
        />
      </span>
      <div
        className="app-cm-card app-cm-card--draft"
        style={popupPosition(pin)}
        role="dialog"
        aria-label="New comment"
      >
        <Composer
          autoFocus
          placeholder="Add a comment..."
          submitLabel="Comment"
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      </div>
    </>
  );
}

function ThreadPopup({
  sceneId,
  thread,
  pin,
  onThread,
  onClose,
}: {
  sceneId: string;
  thread: CommentThread;
  pin: { left: number; top: number };
  onThread: (thread: CommentThread | null) => void;
  onClose: () => void;
}) {
  const toast = useComments()!.notify;
  const userId = useOptionalAuth()?.user?.id;
  const ref = useRef<HTMLDivElement>(null);

  // close on Escape or a click outside (pins and the sidebar list handle their own)
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (
        !ref.current?.contains(target) &&
        !target.closest("[data-comment-pin], .app-comments-panel")
      ) {
        onClose();
      }
    };
    // capture phase: Escape closes just the popup, not Excalidraw's sidebar too
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose]);

  const run = async (action: () => Promise<CommentThread | null>) => {
    try {
      onThread(await action());
    } catch (err: any) {
      toast(err.message);
    }
  };

  return (
    <div
      ref={ref}
      className="app-cm-card"
      style={popupPosition(pin)}
      role="dialog"
      aria-label="Comment thread"
    >
      <div className="app-cm-card__toolbar">
        <button
          type="button"
          className={`app-cm-icon-button${
            thread.resolved_at ? " is-active" : ""
          }`}
          aria-label={thread.resolved_at ? "Reopen" : "Resolve"}
          title={thread.resolved_at ? "Reopen" : "Resolve"}
          onClick={() =>
            run(async () => {
              const res = await api.updateThread(sceneId, thread.id, {
                resolved: !thread.resolved_at,
              });
              if (!thread.resolved_at) {
                onClose();
              }
              return res.thread;
            })
          }
        >
          <CheckCircleIcon />
        </button>
        <button
          type="button"
          className="app-cm-icon-button"
          aria-label="Copy link"
          title="Copy link"
          onClick={() =>
            navigator.clipboard
              .writeText(commentLink(sceneId, thread.id))
              .then(() => toast("Link to comment copied"))
              .catch(() => toast(commentLink(sceneId, thread.id)))
          }
        >
          <LinkIcon />
        </button>
        {thread.created_by === userId && (
          <button
            type="button"
            className="app-cm-icon-button"
            aria-label="Delete thread"
            title="Delete thread"
            onClick={() => {
              if (window.confirm("Delete this comment thread?")) {
                run(async () => {
                  await api.deleteThread(sceneId, thread.id);
                  return null;
                });
              }
            }}
          >
            <TrashIcon />
          </button>
        )}
        <button
          type="button"
          className="app-cm-icon-button"
          aria-label="Close"
          title="Close"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>
      {thread.resolved_at && (
        <p className="app-cm-card__note">
          Resolved by {thread.resolved_by_name ?? "someone"}
        </p>
      )}
      <div className="app-cm-card__comments">
        {thread.comments.map((comment) => (
          <CommentItem
            key={comment.id}
            sceneId={sceneId}
            thread={thread}
            comment={comment}
            onThread={onThread}
          />
        ))}
      </div>
      <div className="app-cm-card__reply">
        <Composer
          placeholder="Reply..."
          submitLabel="Reply"
          onSubmit={async (body) =>
            onThread((await api.replyToThread(sceneId, thread.id, body)).thread)
          }
        />
      </div>
    </div>
  );
}
