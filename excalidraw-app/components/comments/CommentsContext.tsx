import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import api from "../../data/api";
import { serverData } from "../../data/ServerData";

import type { CommentThread } from "../../data/api";
import type { ReactNode } from "react";

// Other people's comments show up within this delay
const POLL_MS = 10000;

type Point = { x: number; y: number };

interface CommentsContextValue {
  /** the open server scene; null when comments aren't available (e.g. unsaved) */
  sceneId: string | null;
  threads: CommentThread[];
  selectedId: string | null;
  select: (threadId: string | null) => void;
  /** "Add comment": the next click on the canvas places the pin */
  placing: boolean;
  setPlacing: (placing: boolean) => void;
  /** placed pin waiting for its first comment */
  draft: Point | null;
  setDraft: (point: Point | null) => void;
  reload: () => Promise<void>;
  createThread: (body: string, at: Point) => Promise<void>;
  /** replace a thread with the server's copy (null: it was deleted) */
  applyThread: (threadId: string, thread: CommentThread | null) => void;
  openPanel: () => void;
  scrollToThread: (thread: CommentThread) => void;
  /** short message in Excalidraw's toast */
  notify: (message: string) => void;
}

const CommentsContext = createContext<CommentsContextValue | null>(null);

export const useComments = () => useContext(CommentsContext);

export function CommentsProvider({
  excalidrawAPI,
  children,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  children: ReactNode;
}) {
  const [sceneId, setSceneId] = useState(
    () => serverData.getSceneInfo()?.id ?? null,
  );
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [draft, setDraft] = useState<Point | null>(null);

  // follow the open scene (it gets an id on its first save)
  useEffect(
    () =>
      serverData.subscribe(() =>
        setSceneId(serverData.getSceneInfo()?.id ?? null),
      ),
    [],
  );

  const reload = useCallback(async () => {
    if (!sceneId) {
      setThreads([]);
      return;
    }
    const res = await api.listComments(sceneId);
    setThreads(res.threads);
  }, [sceneId]);

  useEffect(() => {
    reload().catch(() => {});
    const timer = setInterval(() => {
      if (!document.hidden) {
        reload().catch(() => {});
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const applyThread = useCallback(
    (threadId: string, thread: CommentThread | null) => {
      setThreads((current) =>
        thread
          ? current.some((t) => t.id === threadId)
            ? current.map((t) => (t.id === threadId ? thread : t))
            : [...current, thread]
          : current.filter((t) => t.id !== threadId),
      );
      if (!thread) {
        setSelectedId((id) => (id === threadId ? null : id));
      }
    },
    [],
  );

  const openPanel = useCallback(() => {
    excalidrawAPI?.toggleSidebar({
      name: "default",
      tab: "comments",
      force: true,
    });
  }, [excalidrawAPI]);

  const createThread = useCallback(
    async (body: string, at: Point) => {
      if (!sceneId) {
        throw new Error("Save the scene first by drawing something");
      }
      const res = await api.createCommentThread(sceneId, { body, ...at });
      applyThread(res.thread.id, res.thread);
      setSelectedId(res.thread.id);
      setDraft(null);
    },
    [sceneId, applyThread],
  );

  const scrollToThread = useCallback(
    (thread: CommentThread) => {
      if (!excalidrawAPI) {
        return;
      }
      const { width, height, zoom } = excalidrawAPI.getAppState();
      excalidrawAPI.updateScene({
        appState: {
          scrollX: width / 2 / zoom.value - thread.x,
          scrollY: height / 2 / zoom.value - thread.y,
        },
      });
    },
    [excalidrawAPI],
  );

  // Link to a comment (/s/<id>?comment=<thread>): open it once the threads load
  const [linkedThread, setLinkedThread] = useState(() =>
    new URLSearchParams(window.location.search).get("comment"),
  );
  useEffect(() => {
    const thread = linkedThread && threads.find((t) => t.id === linkedThread);
    if (!thread) {
      return;
    }
    setLinkedThread(null);
    setSelectedId(thread.id);
    scrollToThread(thread);
    const url = new URL(window.location.href);
    url.searchParams.delete("comment");
    window.history.replaceState({}, "", url);
  }, [linkedThread, threads, scrollToThread]);

  const notify = useCallback(
    (message: string) => excalidrawAPI?.setToast({ message, duration: 3000 }),
    [excalidrawAPI],
  );

  const value = useMemo<CommentsContextValue>(
    () => ({
      sceneId,
      threads,
      selectedId,
      select: setSelectedId,
      placing,
      setPlacing,
      draft,
      setDraft,
      reload,
      createThread,
      applyThread,
      openPanel,
      scrollToThread,
      notify,
    }),
    [
      sceneId,
      threads,
      selectedId,
      placing,
      draft,
      reload,
      createThread,
      applyThread,
      openPanel,
      scrollToThread,
      notify,
    ],
  );

  return (
    <CommentsContext.Provider value={value}>
      {children}
    </CommentsContext.Provider>
  );
}
