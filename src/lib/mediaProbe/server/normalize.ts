// src/lib/mediaProbe/server/normalize.ts
//
// エンジンの生メタデータを公開契約へ正規化するためのヘルパ。
// コンテナ名の正規化はエンジン横断で共通化する。

/** mediainfo 等が返すコンテナ表記 → 正規化名。 */
const CONTAINER_MAP: Record<string, string> = {
  "mpeg-4": "mp4",
  "matroska": "mkv",
  "webm": "webm",
  "mpeg audio": "mp3",
  "wave": "wav",
  "ogg": "ogg",
  "flac": "flac",
  "aac": "aac",
  "adts": "aac",
  "quicktime": "mov",
  "avi": "avi",
  "windows media": "asf",
};

/** MPEG-4 系で拡張子から細分化できるもの。 */
const MP4_EXT_REFINE: Record<string, string> = {
  m4a: "m4a",
  m4v: "m4v",
  mov: "mov",
  qt: "mov",
};

/**
 * コンテナ名を正規化する。
 * format（検出コンテナ）を優先し、MPEG-4 系のみ拡張子で細分化する。
 * 判定不能なら null。
 */
export function normalizeContainer(
  format?: string | null,
  fileExtension?: string | null,
): string | null {
  const ext = fileExtension?.toLowerCase() ?? null;
  if (format) {
    const key = format.toLowerCase().trim();
    const mapped = CONTAINER_MAP[key];
    if (mapped === "mp4" && ext && MP4_EXT_REFINE[ext]) {
      return MP4_EXT_REFINE[ext];
    }
    if (mapped) return mapped;
  }
  if (ext) return ext;
  if (format) return format.toLowerCase().trim();
  return null;
}

/** number | 数値文字列 | undefined を number | null へ。 */
export function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** 非空文字列なら string、そうでなければ null。 */
export function toStringOrNull(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") return value;
  if (typeof value === "number") return String(value);
  return null;
}
