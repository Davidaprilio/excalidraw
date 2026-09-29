const AVATAR_SIZE = 256;
// Kept in memory while cropping; plenty for a 256px result
const MAX_WORKING_SIDE = 4096;

/**
 * Decoded image ready for cropping (first frame for GIFs). No file size limit:
 * only the small cropped result is uploaded (and validated by the server).
 * Very large images are scaled down right away to keep memory in check.
 */
export const loadAvatarImage = async (file: File): Promise<ImageBitmap> => {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file");
  }
  const image = await createImageBitmap(file).catch(() => {
    throw new Error("This image couldn't be read");
  });
  const scale = MAX_WORKING_SIDE / Math.max(image.width, image.height);
  if (scale >= 1) {
    return image;
  }
  const scaled = await createImageBitmap(image, {
    resizeWidth: Math.round(image.width * scale),
    resizeHeight: Math.round(image.height * scale),
    resizeQuality: "high",
  });
  image.close();
  return scaled;
};

/** Square region of the source image, in source pixels */
export type AvatarCrop = { x: number; y: number; size: number };

/**
 * Render the crop as a 256x256 square. The circle is only how it's shown: the
 * stored image stays square. Resolves a data URL (webp, or png where the
 * browser can't encode webp): a few KB whatever the original size.
 */
export const renderAvatar = (image: ImageBitmap, crop: AvatarCrop): string => {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.size,
    crop.size,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );
  return canvas.toDataURL("image/webp", 0.85);
};
