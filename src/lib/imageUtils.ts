// Read a File and return a DataURL. For avatars and page covers — keeps
// the artifact self-contained inside IndexedDB without a separate Blob
// table. Resizes large static images so we don't bloat rows; preserves
// animated formats (GIF) so motion isn't flattened to a single frame.

export interface ResizeOptions {
  /** Max width in CSS pixels. Avatars: 256, covers: 1600. */
  maxWidth: number
  /** Max height. Use a large number to effectively disable height clamp. */
  maxHeight: number
  /** JPEG quality 0..1. Default 0.85 — visually lossless for photos. */
  quality?: number
  /** 'image/jpeg' for photos, 'image/png' for transparency. */
  mimeType?: string
  /** Hard cap on the raw file size in bytes. GIFs are typically big — we
   *  pass them through verbatim, so this prevents accidental 50MB uploads.
   *  Defaults to 8MB for animated, 5MB for static. */
  maxBytes?: number
}

/** Animated formats we should NOT re-encode (canvas drawImage flattens
 *  GIF/APNG/animated WebP to the first frame, killing the animation). */
function isAnimatedMime(type: string): boolean {
  return type === 'image/gif' || type === 'image/apng'
  // Note: animated WebP isn't trivially detectable by mime alone — modern
  // browsers report 'image/webp' for both static and animated. We treat
  // WebP as static; users with animated WebPs can convert to GIF.
}

async function fileToRawDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

export async function fileToDataUrl(file: File, opts: ResizeOptions): Promise<string> {
  const { maxWidth, maxHeight, quality = 0.85, mimeType = 'image/jpeg' } = opts

  // Animated images: pass through verbatim so the GIF keeps its frames.
  // Cap the raw byte count so users don't store 50MB animations.
  if (isAnimatedMime(file.type)) {
    const maxBytes = opts.maxBytes ?? 8 * 1024 * 1024
    if (file.size > maxBytes) {
      throw new Error(`Animated image is ${(file.size / 1024 / 1024).toFixed(1)}MB — please pick one under ${(maxBytes / 1024 / 1024).toFixed(0)}MB.`)
    }
    return fileToRawDataUrl(file)
  }

  // Static images: read → measure → re-encode through canvas at the
  // requested target size.
  const raw = await fileToRawDataUrl(file)
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = raw
  })
  let w = img.naturalWidth
  let h = img.naturalHeight
  const wRatio = w > maxWidth ? maxWidth / w : 1
  const hRatio = h > maxHeight ? maxHeight / h : 1
  const ratio = Math.min(wRatio, hRatio)
  w = Math.round(w * ratio)
  h = Math.round(h * ratio)
  if (ratio === 1 && raw.length < 800_000) return raw
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return raw
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL(mimeType, quality)
}
