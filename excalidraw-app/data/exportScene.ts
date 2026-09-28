import { exportToBlob, exportToSvg } from "@excalidraw/excalidraw";
import { MIME_TYPES } from "@excalidraw/common";

import api from "./api";

const download = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** "Quick export": render a saved scene (without opening it) and download it. */
export const exportServerScene = async (
  sceneId: string,
  format: "png" | "svg",
) => {
  const { scene } = await api.getScene(sceneId);
  const opts = {
    elements: scene.elements,
    appState: {
      ...scene.app_state,
      exportBackground: true,
      exportWithDarkMode: false,
    },
    files: null,
    exportPadding: 16,
  };
  const blob =
    format === "png"
      ? await exportToBlob({ ...opts, mimeType: MIME_TYPES.png })
      : new Blob([(await exportToSvg(opts)).outerHTML], {
          type: MIME_TYPES.svg,
        });
  download(blob, `${scene.title || "Untitled"}.${format}`);
};
