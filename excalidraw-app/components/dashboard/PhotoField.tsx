import { useRef, useState } from "react";

import { loadAvatarImage } from "../../data/avatar";

import { AvatarCropDialog } from "./AvatarCropDialog";
import { Avatar, Button, useToast } from "./ui";

/**
 * Photo with Upload/Change + Remove: the chosen image is cropped (1:1 circle)
 * in the browser and only the small square result is handed to `onUpload`.
 * Used for profile photos and workspace photos.
 */
export function PhotoField({
  name,
  src,
  canEdit = true,
  onUpload,
  onRemove,
  hint = "JPG, PNG, WebP or GIF. You can crop it before saving.",
}: {
  /** for the initial shown without a photo */
  name: string;
  src: string | null;
  canEdit?: boolean;
  onUpload: (dataUrl: string) => Promise<void>;
  onRemove: () => Promise<void>;
  hint?: string;
}) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [cropping, setCropping] = useState<ImageBitmap | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = async (file: File) => {
    try {
      setCropping(await loadAvatarImage(file));
    } catch (err: any) {
      toast(err.message);
    }
  };

  const closeCrop = () => {
    cropping?.close();
    setCropping(null);
  };

  const remove = async () => {
    setBusy(true);
    try {
      await onRemove();
    } catch (err: any) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} size="h-16 w-16 text-2xl" src={src} />
      {canEdit && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => fileInput.current?.click()}>
              {src ? "Change photo" : "Upload photo"}
            </Button>
            {src && (
              <Button variant="ghost" disabled={busy} onClick={remove}>
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-gray-500">{hint}</p>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) {
                choose(file);
              }
            }}
          />
        </div>
      )}
      {cropping && (
        <AvatarCropDialog
          image={cropping}
          onApply={async (dataUrl) => {
            await onUpload(dataUrl);
            closeCrop();
          }}
          onClose={closeCrop}
        />
      )}
    </div>
  );
}
