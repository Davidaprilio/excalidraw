import { hashElementsVersion } from "@excalidraw/element";
import { clearAppStateForDatabase } from "@excalidraw/excalidraw/appState";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import api from "./api";
import { getStoredWorkspaceId } from "./workspace";

const SAVE_DEBOUNCE_MS = 2000;

/**
 * The scene a save belongs to. Pending saves keep a reference to their target,
 * so switching scenes can never redirect them to another scene, and a scene
 * created by the first save gets its id filled in for the saves after it.
 */
type SaveTarget = {
  id: string | null;
  onCreated?: (id: string) => void;
  /** where a not-yet-created scene goes (default: Private collection of the current workspace) */
  collectionId?: string;
};

type PendingSave = {
  target: SaveTarget;
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  signature: string;
};

export class ServerData {
  /** null until an editor calls beginScene(); saves are ignored until then */
  private target: SaveTarget | null = null;
  private lastSavedSignature: string | null = null;
  private pending: PendingSave | null = null;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  // Saves run one at a time so a scene is never created twice
  private saveChain: Promise<void> = Promise.resolve();

  /**
   * Start saving to a scene (`null` = new scene, created on first real edit).
   * Pending edits of the previous scene are flushed to that scene first.
   */
  beginScene(
    sceneId: string | null,
    elements: readonly ExcalidrawElement[],
    appState: Partial<AppState>,
    onCreated?: (id: string) => void,
    collectionId?: string,
  ) {
    this.flush();
    this.target = { id: sceneId, onCreated, collectionId };
    this.lastSavedSignature = this.getSignature(elements, appState);
  }

  /** Stop saving (e.g. leaving the editor or the scene failed to load). */
  endScene(): Promise<void> {
    const flushed = this.flush();
    this.target = null;
    this.lastSavedSignature = null;
    return flushed;
  }

  save(elements: readonly ExcalidrawElement[], appState: Partial<AppState>) {
    const target = this.target;
    if (!target) {
      return;
    }

    const signature = this.getSignature(elements, appState);
    if (signature === this.lastSavedSignature) {
      // e.g. scroll/selection changes, or an edit undone before it was saved
      this.cancelPending();
      return;
    }
    // opening "new scene" without drawing anything shouldn't create a board
    if (!target.id && !elements.some((el) => !el.isDeleted)) {
      return;
    }

    this.pending = { target, elements, appState, signature };
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => this.flush(), SAVE_DEBOUNCE_MS);
  }

  /** Send any pending save now. Resolves once all queued saves finished. */
  flush(): Promise<void> {
    const pending = this.pending;
    this.cancelPending();
    if (pending) {
      this.saveChain = this.saveChain.then(() => this.persist(pending));
    }
    return this.saveChain;
  }

  /**
   * Copy the open scene (including unsaved edits) into a new scene.
   * Returns the copy's id, or null when there's nothing saved to copy yet.
   */
  async duplicateCurrentScene(): Promise<string | null> {
    const target = this.target;
    await this.flush();
    if (!target?.id) {
      return null;
    }
    const res = await api.duplicateScene(target.id);
    return res.scene.id;
  }

  hasPendingChanges(): boolean {
    return !!this.pending;
  }

  async load(sceneId: string) {
    try {
      const res = await api.getScene(sceneId);
      return {
        elements: res.scene.elements || [],
        appState: res.scene.app_state || {},
        title: res.scene.title,
        workspaceId: res.scene.workspace_id as string,
      };
    } catch (err) {
      console.error("Server load failed:", err);
      return null;
    }
  }

  async uploadFile(file: File, fileId?: string) {
    try {
      return await api.uploadFile(file, this.target?.id || undefined, fileId);
    } catch (err) {
      console.error("File upload failed:", err);
      return null;
    }
  }

  getFileUrl(fileId: string): string {
    return api.getFileUrl(fileId);
  }

  private cancelPending() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.pending = null;
  }

  private async persist({
    target,
    elements,
    appState,
    signature,
  }: PendingSave) {
    try {
      const sanitizedAppState = this.sanitizeAppState(appState);
      if (target.id) {
        await api.updateScene(target.id, {
          elements: elements as any[],
          appState: sanitizedAppState,
        });
      } else {
        const res = await api.createScene({
          elements: elements as any[],
          appState: sanitizedAppState,
          ...(target.collectionId
            ? { collectionId: target.collectionId }
            : { workspaceId: getStoredWorkspaceId() ?? undefined }),
        });
        target.id = res.scene.id;
        target.onCreated?.(res.scene.id);
      }
      if (target === this.target) {
        this.lastSavedSignature = signature;
      }
    } catch (err) {
      console.error("Server save failed:", err);
    }
  }

  // Elements + the appState fields that belong to the drawing itself
  private getSignature(
    elements: readonly ExcalidrawElement[],
    appState: Partial<AppState>,
  ): string {
    return `${hashElementsVersion(elements)}:${appState.viewBackgroundColor}`;
  }

  // Only drawing-level settings (grid, background...). UI state such as an
  // open menu must not be persisted, or it reappears when the board is opened.
  private sanitizeAppState(appState: Partial<AppState>) {
    return clearAppStateForDatabase(appState);
  }
}

export const serverData = new ServerData();
export default serverData;
