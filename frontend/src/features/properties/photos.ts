/** Client-side photo preparation before upload. */

export const MAX_PHOTOS = 20;
const MAX_EDGE = 2048;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export type PreparedPhoto = { blob: Blob; name: string };

/**
 * Downscale large photos in the browser (phones produce 4–12 MB files; slow or
 * VPN connections make those uploads painful). Re-encoding on a canvas also
 * drops EXIF/GPS metadata before anything leaves the device. The server
 * re-processes every image anyway, so any failure here just falls back to the
 * original file.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no-canvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) throw new Error("encode-failed");
    // Keep the original if re-encoding somehow made a small file larger.
    if (blob.size >= file.size && file.size <= MAX_UPLOAD_BYTES && /jpe?g|png|webp/i.test(file.type)) {
      return { blob: file, name: file.name };
    }
    return { blob, name: `${baseName}.jpg` };
  } catch {
    return { blob: file, name: file.name };
  }
}

export function validatePhoto(file: File): string | null {
  if (!file.type.startsWith("image/")) return `«${file.name}» تصویر نیست`;
  if (file.size > 40 * 1024 * 1024) return `«${file.name}» بیش از حد بزرگ است`;
  return null;
}
