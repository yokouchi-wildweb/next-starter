// src/lib/storage/contentTypes.ts
//
// Content-Type の照合・拡張子の対応・配信時の inline / attachment 判定（client-safe の純関数）。
//
// 「受け付けてよい型」（用途の contentTypes が決める）と「ブラウザに inline 表示させてよい型」は別物。
// inline にするのは下の固定表（画像・動画・音声）だけで、HTML / SVG / XML などの文書型と、
// 表に無い一般ファイルはすべて attachment にする。用途が受け付けた型でも、ここで inline になるとは限らない。
// commit で照合するのは size・申告された MIME・generation だけで、ファイルの中身は検査していない。
// そのため、申告どおりの型として inline 表示しても安全な型だけを表に載せる。

/** inline 表示を許す型（固定表。下流から追加する口は設けない） */
export const INLINE_CONTENT_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/flac",
];

const INLINE_SET = new Set(INLINE_CONTENT_TYPES);

/** Content-Type → 保存時の拡張子。表に無い型は "bin" */
const EXTENSION_BY_CONTENT_TYPE: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogv",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "weba",
  "audio/flac": "flac",
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/json": "json",
  "application/gzip": "gz",
  "text/plain": "txt",
  "text/csv": "csv",
};

export const FALLBACK_EXTENSION = "bin";

export type StorageContentDisposition = "inline" | "attachment";

const CONTENT_TYPE_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;

/**
 * Content-Type を比較用に正規化する（小文字化・パラメータ除去）。
 * `type/subtype` の形でなければ null。
 */
export function normalizeContentType(value: string | null | undefined): string | null {
  if (!value) return null;
  const base = value.split(";")[0]?.trim().toLowerCase() ?? "";
  return CONTENT_TYPE_PATTERN.test(base) ? base : null;
}

/**
 * 型が許可リストのどれかに一致するか。
 * パターンは完全一致（"image/png"）か、サブタイプのワイルドカード（"image/*"）。
 * "image/*" は image/svg+xml にも一致する。受け付けた後の表示は contentDispositionFor が別に決める。
 */
export function matchesContentType(
  contentType: string | null | undefined,
  patterns: readonly string[],
): boolean {
  const normalized = normalizeContentType(contentType);
  if (!normalized) return false;
  const [type] = normalized.split("/");
  return patterns.some((raw) => {
    const pattern = raw.trim().toLowerCase();
    if (pattern.endsWith("/*")) return pattern.slice(0, -2) === type;
    return pattern === normalized;
  });
}

/** 保存時の拡張子（ドットなし）。表に無い型・不正な型は "bin" */
export function extensionForContentType(contentType: string | null | undefined): string {
  const normalized = normalizeContentType(contentType);
  if (!normalized) return FALLBACK_EXTENSION;
  return EXTENSION_BY_CONTENT_TYPE[normalized] ?? FALLBACK_EXTENSION;
}

/** inline 表示してよい型か（固定表に載っているか） */
export function isInlineContentType(contentType: string | null | undefined): boolean {
  const normalized = normalizeContentType(contentType);
  return normalized !== null && INLINE_SET.has(normalized);
}

/**
 * 配信時の Content-Disposition。
 * 公開ファイルのオブジェクト metadata と、非公開ファイルの署名 URL の応答指定の両方に使う。
 * 不明な型・不正な型は attachment（安全側）。
 */
export function contentDispositionFor(
  contentType: string | null | undefined,
): StorageContentDisposition {
  return isInlineContentType(contentType) ? "inline" : "attachment";
}
