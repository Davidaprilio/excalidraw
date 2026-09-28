import { exportToBlob } from "@excalidraw/excalidraw";
import { MIME_TYPES } from "@excalidraw/common";

import api from "./api";

// ~2x the dashboard card, so previews stay sharp on HiDPI screens
const THUMBNAIL_MAX_SIZE = 600;

const blobToDataURL = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Render the scene's current content and store it as its thumbnail. */
const renderAndSaveThumbnail = async (sceneId: string) => {
  const { scene } = await api.getScene(sceneId);
  const blob = await exportToBlob({
    elements: scene.elements,
    appState: {
      ...scene.app_state,
      exportBackground: true,
      exportWithDarkMode: false,
    },
    files: null,
    // browsers without webp encoding (Safari) fall back to png
    mimeType: MIME_TYPES.webp,
    maxWidthOrHeight: THUMBNAIL_MAX_SIZE,
    exportPadding: 24,
  });
  const res = await api.saveSceneThumbnail(
    sceneId,
    await blobToDataURL(blob),
    scene.version,
  );
  return res.thumbnailVersion;
};

// Render one thumbnail at a time, and each scene version at most once per page load
let queue: Promise<unknown> = Promise.resolve();
const requested = new Map<string, Promise<number | null>>();

/**
 * Make sure the scene has a thumbnail for `version` (generating it if missing
 * or stale). Resolves with the stored thumbnail's scene version.
 */
export const ensureSceneThumbnail = (
  sceneId: string,
  version: number,
): Promise<number | null> => {
  const key = `${sceneId}:${version}`;
  let pending = requested.get(key);
  if (!pending) {
    pending = queue.then(() => renderAndSaveThumbnail(sceneId));
    queue = pending.catch(() => {});
    requested.set(key, pending);
  }
  return pending;
};
