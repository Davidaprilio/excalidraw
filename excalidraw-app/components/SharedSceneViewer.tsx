import { useCallback, useEffect, useState } from "react";

import { Excalidraw, MainMenu } from "@excalidraw/excalidraw";
import {
  chevronLeftIcon,
  ExportIcon,
  eyeClosedIcon,
  eyeIcon,
} from "@excalidraw/excalidraw/components/icons";
import {
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";

import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";

import api from "../data/api";
import { navigateTo } from "../navigation";

const FOCUS_SHORTCUT = "Ctrl+\\";

type ViewerState =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      title: string;
      initialData: ExcalidrawInitialDataState;
      /** the sharer lets viewers "Save to..." a copy */
      allowSave: boolean;
    };

/**
 * Read-only view of a scene opened through a public share link: the scene's own
 * link (`token`), or a scene of a shared collection (`load`, with a way back).
 */
export function SharedSceneViewer({
  token,
  load,
  back,
}: {
  token?: string;
  load?: () => Promise<{ scene: any }>;
  back?: { label: string; href: string };
}) {
  const [state, setState] = useState<ViewerState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (load ?? (() => api.getSharedScene(token!)))()
      .then(({ scene }) => {
        if (cancelled) {
          return;
        }
        setState({
          status: "ready",
          title: scene.title,
          allowSave: scene.allow_save === true,
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
    // `load` is recreated by the parent on each render; the token/route is the key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Focus mode: only the drawing (menu, zoom, help and title hidden)
  const [focus, setFocus] = useState(false);
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);

  const toggleFocus = useCallback(() => {
    if (!focus) {
      // the menu gets hidden: say how to get back
      excalidrawAPI?.setToast({
        message: `Focus mode · ${FOCUS_SHORTCUT} or Esc to exit`,
        duration: 3000,
      });
    }
    setFocus(!focus);
  }, [focus, excalidrawAPI]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "\\") {
        event.preventDefault();
        toggleFocus();
      } else if (event.key === "Escape" && focus) {
        setFocus(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focus, toggleFocus]);

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
    <div
      style={{ height: "100vh" }}
      className={`shared-viewer${focus ? " shared-viewer--focus" : ""}`}
    >
      <Excalidraw
        initialData={state.initialData}
        name={state.title}
        onExcalidrawAPI={setExcalidrawAPI}
        viewModeEnabled
        contextMenuItems={() => [
          {
            name: "focusMode",
            label: focus ? "Exit focus mode" : "Focus mode",
            onSelect: toggleFocus,
          },
        ]}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            clearCanvas: false,
            // no "Save to..." dialog unless the sharer allows it
            export: state.allowSave ? { saveFileToDisk: true } : false,
          },
        }}
      >
        {/* the default menu minus "Excalidraw links" (GitHub, X, Discord) */}
        <MainMenu>
          {back && (
            <>
              <MainMenu.Item
                icon={chevronLeftIcon}
                onSelect={() => navigateTo(back.href)}
              >
                {back.label}
              </MainMenu.Item>
              <MainMenu.Separator />
            </>
          )}
          {state.allowSave ? (
            <MainMenu.DefaultItems.Export />
          ) : (
            <MainMenu.Item
              icon={ExportIcon}
              disabled
              title="Saving is turned off for this link"
              onSelect={() => {}}
            >
              Save to...
            </MainMenu.Item>
          )}
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.SearchMenu />
          <MainMenu.DefaultItems.Help />
          <MainMenu.Item
            icon={focus ? eyeIcon : eyeClosedIcon}
            shortcut={FOCUS_SHORTCUT}
            onSelect={toggleFocus}
          >
            Focus mode
          </MainMenu.Item>
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ToggleTheme allowSystemTheme={false} />
        </MainMenu>
        <div className="shared-viewer-title" title={state.title}>
          {state.title}
        </div>
      </Excalidraw>
    </div>
  );
}
