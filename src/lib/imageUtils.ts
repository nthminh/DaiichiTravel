/**
 * Compress an image file using the Canvas API before uploading to Firebase Storage.
 * Outputs WebP format for smaller file sizes and better performance.
 * Falls back to JPEG if the browser does not support WebP encoding.
 * @param file     The original image File
 * @param quality  Quality 0–1 (default 0.80)
 * @param maxWidth Maximum width in pixels (default 1280)
 * @returns        A new compressed File (image/webp or image/jpeg as fallback)
 */
export async function compressImage(
  file: File,
  quality = 0.80,
  maxWidth = 1280
): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
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
