// src/lib/crud/storageIntegration/cleanupFiles.ts

import { remove as removeFile } from "@/lib/storage/server/wrappers/remove";

/**
 * レコードからストレージURLを取得して削除する
 * エラーは無視（ファイルが既に存在しない場合など）
 */
export async function cleanupStorageFiles(
  record: Record<string, unknown>,
  storageFields: string[]
): Promise<void> {
  const deletePromises = storageFields
    .map((field) => record[field])
    .filter((url): url is string => typeof url === "string" && url !== "")
    .map((url) => removeFile(url).catch(() => {}));

  await Promise.all(deletePromises);
}
