export type MediaType = "image" | "video" | "unknown";

export type MediaSource = {
  file?: File | null;
  src?: string | null;
  mimeType?: string | null;
};

export type MediaOrientation = "landscape" | "portrait" | "square";

export type BaseMediaMetadata = {
  width: number;
  height: number;
  aspectRatio: number;
  orientation: MediaOrientation;
  mimeType?: string | null;
  sizeBytes?: number | null;
  src?: string | null;
};

export type ImageMetadata = BaseMediaMetadata;

export type VideoMetadata = BaseMediaMetadata & {
  durationSec: number;
  durationFormatted: string;
};

export type SelectedMediaMetadata = {
  image?: ImageMetadata | null;
  video?: VideoMetadata | null;
};

export type FileValidationRule = {
  /** 許可する MIME タイプ（例: ["image/png", "image/jpeg"]） */
  allowedMimeTypes?: string[];
  /** 許可する拡張子（例: ["png", "jpg"]） */
  allowedExtensions?: string[];
  /** 最大ファイルサイズ（バイト単位） */
  maxSizeBytes?: number;
};

export type FileValidationError =
  | { type: "mime"; message: string; fileName?: string }
  | { type: "extension"; message: string; fileName?: string }
  | { type: "size"; message: string; fileName?: string; maxSizeBytes: number };

const IMAGE_MIME_PREFIX = "image/";
const VIDEO_MIME_PREFIX = "video/";
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "bmp", "svg"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "ogg", "mov", "m4v", "avi", "mkv"]);

function getExtensionFromSrc(src?: string | null) {
  if (!src) return null;
  try {
    const url = new URL(src, "http://dummy");
    const pathname = url.pathname ?? src;
    const segments = pathname.split("/");
    const last = segments[segments.length - 1];
    const dotIndex = last.lastIndexOf(".");
    if (dotIndex === -1) return null;
    return last.slice(dotIndex + 1).toLowerCase();
  } catch {
    const cleaned = src.split(/[?#]/)[0];
    const dotIndex = cleaned.lastIndexOf(".");
    if (dotIndex === -1) return null;
    return cleaned.slice(dotIndex + 1).toLowerCase();
  }
}

export function detectMediaType({ file, mimeType, src }: MediaSource): MediaType {
  const resolvedMime = file?.type || mimeType || null;
  if (resolvedMime?.startsWith(IMAGE_MIME_PREFIX)) {
    return "image";
  }
  if (resolvedMime?.startsWith(VIDEO_MIME_PREFIX)) {
    return "video";
  }

  const extension = getExtensionFromSrc(file?.name ?? src ?? null);
  if (extension) {
    if (IMAGE_EXTENSIONS.has(extension)) return "image";
    if (VIDEO_EXTENSIONS.has(extension)) return "video";
  }

  return "unknown";
}

export function resolveMediaOrientation(width: number, height: number): MediaOrientation {
  if (width === height) return "square";
  if (width > height) return "landscape";
  return "portrait";
}
