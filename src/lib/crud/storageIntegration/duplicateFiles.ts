// src/lib/crud/storageIntegration/duplicateFiles.ts

import { copyFileServer, getPathFromStorageUrl } from "@/lib/firebase/server/storage";
import { uuidv7 } from "uuidv7";
import type { StorageFieldInfo } from "./extractStorageFields";

/**
 * レコードのストレージファイルを複製し、新しいURLのマップを返す
 *
 * @param record - 元のレコード
 * @param storageFieldsInfo - ストレージフィールド情報の配列（name, uploadPath）
 * @returns フィールド名と新しいURLのマップ
 */
export async function duplicateStorageFiles(
  record: Record<string, unknown>,
  storageFieldsInfo: StorageFieldInfo[]
): Promise<Record<string, string>> {
  const newUrls: Record<string, string> = {};

  const copyPromises = storageFieldsInfo.map(async ({ name, uploadPath }) => {
    const url = record[name];
    if (typeof url !== "string" || url === "") {
      return;
    }

    const sourcePath = getPathFromStorageUrl(url);
    if (!sourcePath) {
      return;
    }

    // 元のファイル名から拡張子を取得
    const lastSlash = sourcePath.lastIndexOf("/");
    const fileName = lastSlash >= 0 ? sourcePath.substring(lastSlash + 1) : sourcePath;
    const ext = fileName.includes(".") ? fileName.substring(fileName.lastIndexOf(".")) : "";

    // domain.jsonで指定されたuploadPathを使用して新しいパスを生成
    const destPath = uploadPath ? `${uploadPath}/${uuidv7()}${ext}` : `${uuidv7()}${ext}`;

    try {
      const newUrl = await copyFileServer(sourcePath, destPath);
      newUrls[name] = newUrl;
    } catch {
      // コピー失敗時は元のURLを維持しない（新レコードなので空にする）
    }
  });

  await Promise.all(copyPromises);

  return newUrls;
}
