import { useEffect, useState } from "react";

import { Excalidraw } from "@excalidraw/excalidraw";
import {
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";

import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";

import api from "../data/api";

type ViewerState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; title: string; initialData: ExcalidrawInitialDataState };

/** Read-only view of a scene opened through a public share link. */
export function SharedSceneViewer({ token }: { token: string }) {
  const [state, setState] = useState<ViewerState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    api
      .getSharedScene(token)
      .then(({ scene }) => {
        if (cancelled) {
          return;
        }
        setState({
          status: "ready",
          title: scene.title,
          initialData: {
            elements: restoreElements(scene.elements, null, {
              repairBindings: true,
              deleteInvisibleElements: true,
            }),
            appState: restoreAppState(scene.app_state, null),
            scrollToContent: true,
          },
        });
      })
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (state.status === "ready") {
      document.title = `${state.title} - Excalidraw`;
    }
  }, [state]);

  if (state.status !== "ready") {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          color: "#374151",
        }}
      >
        {state.status === "loading"
          ? "Loading..."
          : "This link is invalid or sharing has been turned off."}
      </div>
    );
  }

  return (
    <div style={{ height: "100vh" }}>
      <Excalidraw
        initialData={state.initialData}
        name={state.title}
        viewModeEnabled
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            clearCanvas: false,
          },
        }}
      />
    </div>
  );
}
