import { useEffect, useMemo, useRef, useState } from "react";

import { renderAvatar } from "../../data/avatar";

import { Button, Modal } from "./ui";

import type { PointerEvent as ReactPointerEvent } from "react";

// Viewport and the circle inside it (CSS px)
const VIEWPORT = 320;
const CROP = 260;
const MAX_ZOOM = 5;

type View = { zoom: number; x: number; y: number };

/**
 * Crop a profile photo: a 1:1 circle over the image, drag to move, slider /
 * wheel / keys to zoom. `onApply` gets the square crop as a small data URL.
 */
export function AvatarCropDialog({
  image,
  onApply,
  onClose,
}: {
  image: ImageBitmap;
  onApply: (dataUrl: string) => Promise<void>;
  onClose: () => void;
}) {
  // Scale at which the image's short side exactly covers the circle
  const baseScale = CROP / Math.min(image.width, image.height);
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const drag = useRef<{
    pointerX: number;
    pointerY: number;
    x: number;
    y: number;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // x/y: image center offset from the viewport center, kept so the circle stays covered
  const clamp = (next: View): View => {
    const zoom = Math.min(Math.max(next.zoom, 1), MAX_ZOOM);
    const scale = baseScale * zoom;
    const maxX = Math.max(0, (image.width * scale - CROP) / 2);
    const maxY = Math.max(0, (image.height * scale - CROP) / 2);
    return {
      zoom,
      x: Math.min(Math.max(next.x, -maxX), maxX),
      y: Math.min(Math.max(next.y, -maxY), maxY),
    };
  };
  const update = (change: (current: View) => View) =>
    setView((current) => clamp(change(current)));

  const scale = baseScale * view.zoom;
  const width = image.width * scale;
  const height = image.height * scale;
  const left = VIEWPORT / 2 - width / 2 + view.x;
  const top = VIEWPORT / 2 - height / 2 + view.y;

  // Draw the (possibly huge) image once into a display-sized canvas
  const previewScale = useMemo(
    () =>
      Math.min(
        1,
        (VIEWPORT * MAX_ZOOM * 2) / Math.max(image.width, image.height),
      ),
    [image],
  );
  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = Math.round(image.width * previewScale);
    canvas.height = Math.round(image.height * previewScale);
    canvas
      .getContext("2d")!
      .drawImage(image, 0, 0, canvas.width, canvas.height);
  }, [image, previewScale]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: view.x,
      y: view.y,
    };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (start) {
      update((current) => ({
        ...current,
        x: start.x + event.clientX - start.pointerX,
        y: start.y + event.clientY - start.pointerY,
      }));
    }
  };

  const apply = async () => {
    // circle's bounding square, back in source-image pixels
    const cropLeft = (VIEWPORT - CROP) / 2;
    const cropTop = (VIEWPORT - CROP) / 2;
    setBusy(true);
    setError("");
    try {
      await onApply(
        renderAvatar(image, {
          x: (cropLeft - left) / scale,
          y: (cropTop - top) / scale,
          size: CROP / scale,
        }),
      );
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Crop your photo" onClose={onClose}>
      <div className="flex flex-col items-center gap-4">
        <div
          role="application"
          aria-label="Photo crop area. Drag or use the arrow keys to move, + and - to zoom."
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onWheel={(event) =>
            update((current) => ({
              ...current,
              zoom: current.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1),
            }))
          }
          onKeyDown={(event) => {
            const step = event.shiftKey ? 30 : 8;
            const moves: Record<string, Partial<View>> = {
              ArrowLeft: { x: view.x + step },
              ArrowRight: { x: view.x - step },
              ArrowUp: { y: view.y + step },
              ArrowDown: { y: view.y - step },
              "+": { zoom: view.zoom * 1.1 },
              "=": { zoom: view.zoom * 1.1 },
              "-": { zoom: view.zoom / 1.1 },
            };
            if (moves[event.key]) {
              event.preventDefault();
              update((current) => ({ ...current, ...moves[event.key] }));
            }
          }}
          className="relative cursor-grab touch-none overflow-hidden rounded-lg bg-gray-900 outline-none select-none focus-visible:ring-2 focus-visible:ring-indigo-400 active:cursor-grabbing"
          style={{ width: VIEWPORT, height: VIEWPORT }}
        >
          <canvas
            ref={canvasRef}
            aria-hidden
            className="pointer-events-none absolute max-w-none"
            style={{ left, top, width, height }}
          />
          {/* the 1:1 circle; its huge shadow dims everything outside it */}
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-full border-2 border-white/90"
            style={{
              left: (VIEWPORT - CROP) / 2,
              top: (VIEWPORT - CROP) / 2,
              width: CROP,
              height: CROP,
              boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.6)",
            }}
          />
        </div>

        <div className="flex w-full items-center gap-3">
          <Button
            variant="ghost"
            aria-label="Zoom out"
            onClick={() => update((c) => ({ ...c, zoom: c.zoom / 1.2 }))}
          >
            −
          </Button>
          <input
            type="range"
            aria-label="Zoom"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={view.zoom}
            onChange={(event) =>
              update((c) => ({ ...c, zoom: Number(event.target.value) }))
            }
            className="flex-1 accent-indigo-600"
          />
          <Button
            variant="ghost"
            aria-label="Zoom in"
            onClick={() => update((c) => ({ ...c, zoom: c.zoom * 1.2 }))}
          >
            +
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          Drag to reposition. The photo is saved as a small square image.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy} onClick={apply}>
          {busy ? "Saving..." : "Apply"}
        </Button>
      </div>
    </Modal>
  );
}
