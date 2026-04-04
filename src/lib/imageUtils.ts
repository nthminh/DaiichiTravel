/**
 * Compress an image file using the Canvas API before uploading to Supabase Storage.
 * Outputs WebP format for smaller file sizes and better performance.
 * Falls back to JPEG if the browser does not support WebP encoding.
 * @param file      The original image File
 * @param quality   Quality 0–1 (default 0.75 — good balance between file size and visual quality)
 * @param maxWidth  Maximum width in pixels (default 1280)
 * @param maxHeight Maximum height in pixels (default 960); preserves aspect ratio
 * @returns         A new compressed File (image/webp or image/jpeg as fallback)
 */
export async function compressImage(
  file: File,
  quality = 0.75,
  maxWidth = 1280,
  maxHeight = 960
): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      // Scale down proportionally to fit within maxWidth × maxHeight
      const widthRatio = width > maxWidth ? maxWidth / width : 1;
      const heightRatio = height > maxHeight ? maxHeight / height : 1;
      const scale = Math.min(widthRatio, heightRatio);
      if (scale < 1) {
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Prefer WebP for ~30-50 % smaller files; fall back to JPEG when unsupported.
      const supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
      const mimeType = supportsWebP ? 'image/webp' : 'image/jpeg';
      const ext = supportsWebP ? '.webp' : '.jpg';

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob returned null'));
            return;
          }
          const compressed = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, ext),
            { type: mimeType, lastModified: Date.now() }
          );
          resolve(compressed);
        },
        mimeType,
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };
    img.src = url;
  });
}

/**
 * Generate a tiny low-quality image placeholder (LQIP / blur placeholder)
 * as a base64 data URL. Use it as the `src` while the real image loads,
 * then swap to the full URL once loaded — this eliminates layout shift and
 * gives users a blurry preview instantly.
 *
 * @param file       The original image File (or a compressed version)
 * @param thumbWidth Width of the placeholder thumbnail in pixels (default 20)
 * @returns          A base64 JPEG data URL string (typically ~300–600 bytes)
 */
export async function generateBlurPlaceholder(
  file: File,
  thumbWidth = 20
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const aspectRatio = img.height / img.width;
      const thumbHeight = Math.round(thumbWidth * aspectRatio);
      const canvas = document.createElement('canvas');
      canvas.width = thumbWidth;
      canvas.height = thumbHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight);
      resolve(canvas.toDataURL('image/jpeg', 0.4));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for placeholder generation'));
    };
    img.src = url;
  });
}
