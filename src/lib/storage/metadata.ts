// src/lib/storage/metadata.ts
//
// 用途の metadata（strip / keep）の判定（client-safe の純関数）。発行・commit・サーバー内の書き込みと複製の照合はこの 1 か所を使う。
//
// strip の用途:
// - 画像は STRIP_IMAGE_TYPES の型だけを受け付ける（contentTypes の "image/*" はこの集合に読み替える）。
//   サーバーが描き直せない画像型（HEIC・SVG・TIFF など）は、contentTypes に書いてあっても受け付けない
// - 画像以外の型（動画・音声・一般ファイル）は今までどおり受け取ったまま保存する（処理の対象外）
// keep の用途: contentTypes のとおりに受け付け、受け取ったまま保存する

import { matchesContentType, normalizeContentType } from "./contentTypes";
import type { StorageMetadataPolicy, StoragePurpose } from "./policy/types";

/** strip の用途で受け付ける画像の型（サーバーが描き直せる型） */
export const STRIP_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"] as const;

const STRIP_IMAGE_SET = new Set<string>(STRIP_IMAGE_TYPES);

function isImageType(normalized: string): boolean {
  return normalized.startsWith("image/");
}

/** 用途の metadata。省略 = strip */
export function resolvePurposeMetadata(purpose: Pick<StoragePurpose, "metadata">): StorageMetadataPolicy {
  return purpose.metadata ?? "strip";
}

/** この型のファイルを、この用途では描き直して保存するか（strip の用途の画像） */
export function requiresStrip(
  purpose: Pick<StoragePurpose, "metadata">,
  contentType: string | null | undefined,
): boolean {
  const normalized = normalizeContentType(contentType);
  return normalized !== null && isImageType(normalized) && resolvePurposeMetadata(purpose) === "strip";
}

/**
 * この型を、この用途で受け付けるか。
 * contentTypes に一致し、strip の用途の画像なら STRIP_IMAGE_TYPES のどれかであること。
 */
export function isAcceptableForPurpose(
  purpose: Pick<StoragePurpose, "metadata" | "contentTypes">,
  contentType: string | null | undefined,
): boolean {
  const normalized = normalizeContentType(contentType);
  if (!normalized || !matchesContentType(normalized, purpose.contentTypes)) return false;
  if (requiresStrip(purpose, normalized)) return STRIP_IMAGE_SET.has(normalized);
  return true;
}
