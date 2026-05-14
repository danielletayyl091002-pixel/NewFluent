// Read a File and return a DataURL. For avatars and page covers — keeps
// the artifact self-contained inside IndexedDB without a separate Blob
// table. Resizes large images so we don't bloat rows.

export interface ResizeOptions {
  /** Max width in CSS pixels. Avatars: 256, covers: 1600. */
  maxWidth: number
  /** Max height. Use a large number to effectively disable height clamp. */
  maxHeight: number
  /** JPEG quality 0..1. Default 0.85 — visually lossless for photos. */
  quality?: number
  /** 'image/jpeg' for photos, 'image/png' for transparency. */
  mimeType?: string
}

export async function fileToDataUrl(file: File, opts: ResizeOptions): Promise<string> {
  const { maxWidth, maxHeight, quality = 0.85, mimeType = 'image/jpeg' } = opts
  // Read file as DataURL first so we can load it into an Image element.
  const raw = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
  // Decode dimensions
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = raw
  })
  // Compute target size keeping aspect ratio
  let w = img.naturalWidth
  let h = img.naturalHeight
  const wRatio = w > maxWidth ? maxWidth / w : 1
  const hRatio = h > maxHeight ? maxHeight / h : 1
  const ratio = Math.min(wRatio, hRatio)
  w = Math.round(w * ratio)
  h = Math.round(h * ratio)
  // Already small? Return raw DataURL (saves a re-encode).
  if (ratio === 1 && raw.length < 800_000) return raw
  // Re-encode through canvas
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return raw
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL(mimeType, quality)
}
