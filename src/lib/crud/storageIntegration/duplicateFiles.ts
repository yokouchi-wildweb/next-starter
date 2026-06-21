// src/lib/crud/storageIntegration/duplicateFiles.ts

import { copyFileServer, getPathFromStorageUrl } from "@/lib/firebase/server/storage";
import { uuidv7 } from "uuidv7";
import type { StorageFieldInfo } from "./extractStorageFields";

/**
 * 単一のストレージURLを新しいパスへコピーし、新URLを返す。
 * コピー不能・失敗時は undefined を返す（呼び出し側で除外する）。
 */
async function copyOneFile(url: string, uploadPath: string): Promise<string | undefined> {
  if (url === "") return undefined;

  const sourcePath = getPathFromStorageUrl(url);
  if (!sourcePath) return undefined;

  // 元のファイル名から拡張子を取得
  const lastSlash = sourcePath.lastIndexOf("/");
  const fileName = lastSlash >= 0 ? sourcePath.substring(lastSlash + 1) : sourcePath;
  const ext = fileName.includes(".") ? fileName.substring(fileName.lastIndexOf(".")) : "";

  // domain.jsonで指定されたuploadPathを使用して新しいパスを生成
  const destPath = uploadPath ? `${uploadPath}/${uuidv7()}${ext}` : `${uuidv7()}${ext}`;

  try {
    return await copyFileServer(sourcePath, destPath);
  } catch {
    // コピー失敗時は undefined（元ファイルを共有しないよう、複製側からは外す）
    return undefined;
  }
}

/**
 * レコードのストレージファイルを複製し、新しいURLのマップを返す。
 * 単一ファイル（string）・複数ファイル（string[]）の両方に対応する。
 * - mediaUploader: 成功時のみ新URL(string)を設定（失敗時は未設定＝元レコードの値を維持）
 * - mediaUploaderMulti: 各要素を個別の新パスへコピーし、成功分の string[] を設定
 *
 * @param record - 元のレコード
 * @param storageFieldsInfo - ストレージフィールド情報の配列（name, uploadPath）
 * @returns フィールド名と新しいURL（string または string[]）のマップ
 */
export async function duplicateStorageFiles(
  record: Record<string, unknown>,
  storageFieldsInfo: StorageFieldInfo[]
): Promise<Record<string, string | string[]>> {
  const newUrls: Record<string, string | string[]> = {};

  const copyPromises = storageFieldsInfo.map(async ({ name, uploadPath }) => {
    const value = record[name];

    if (typeof value === "string") {
      const newUrl = await copyOneFile(value, uploadPath);
      if (newUrl) {
        newUrls[name] = newUrl;
      }
      return;
    }

    if (Array.isArray(value)) {
      const sourceUrls = value.filter((item): item is string => typeof item === "string" && item !== "");
      const copied = await Promise.all(sourceUrls.map((url) => copyOneFile(url, uploadPath)));
      // 成功分のみを再代入（失敗要素は除外。元ファイルの共有参照を残さない）
      newUrls[name] = copied.filter((url): url is string => Boolean(url));
    }
  });

  await Promise.all(copyPromises);

  return newUrls;
}
