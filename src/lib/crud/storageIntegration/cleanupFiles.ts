// src/lib/crud/storageIntegration/cleanupFiles.ts

import { remove as removeFile } from "@/lib/storage/server/wrappers/remove";

/**
 * フィールド値から削除対象の URL 一覧を取り出す。
 * - mediaUploader: string（単一 URL）
 * - mediaUploaderMulti: string[]（複数 URL）
 * 空文字・null・非文字列要素は除外する。
 */
function collectUrls(value: unknown): string[] {
  if (typeof value === "string") {
    return value !== "" ? [value] : [];
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item !== "");
  }
  return [];
}

/**
 * レコードからストレージURLを取得して削除する。
 * 単一ファイル（string）・複数ファイル（string[]）の両方に対応する。
 * エラーは無視（ファイルが既に存在しない場合など）
 */
export async function cleanupStorageFiles(
  record: Record<string, unknown>,
  storageFields: string[]
): Promise<void> {
  const urls = storageFields.flatMap((field) => collectUrls(record[field]));
  const deletePromises = urls.map((url) => removeFile(url).catch(() => {}));

  await Promise.all(deletePromises);
}
