// src/lib/firebase/server/storage.ts

import { getServerStorage } from "./app";
/**
 * Firebase Storage にファイルをアップロードする（サーバー用）
 *
 * @param path - Storage 内の保存パス
 * @param buffer - アップロードする Buffer
 * @param contentType - ファイルの MIME タイプ
 * @returns アップロード後の公開 URL
 */
export async function uploadFileServer(path: string, buffer: Buffer, contentType?: string): Promise<string> {
  const bucket = getServerStorage().bucket();
  const file = bucket.file(path);
  await file.save(buffer, {
    contentType,
    metadata: { cacheControl: "public, max-age=31536000, immutable" },
  });
  await file.makePublic();
  return file.publicUrl();
}

export async function deleteFileServer(path: string): Promise<void> {
  const bucket = getServerStorage().bucket();
  const file = bucket.file(path);
  await file.delete();
}

/**
 * Firebase Storage のファイルを複製する（サーバー用）
 *
 * @param sourcePath - コピー元のパス
 * @param destPath - コピー先のパス
 * @returns コピー後の公開 URL
 */
export async function copyFileServer(sourcePath: string, destPath: string): Promise<string> {
  const bucket = getServerStorage().bucket();
  const sourceFile = bucket.file(sourcePath);
  const destFile = bucket.file(destPath);
  await sourceFile.copy(destFile);
  await destFile.makePublic();
  return destFile.publicUrl();
}

export function getPathFromStorageUrl(url: string): string | undefined {
  try {
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucket) return undefined;
    const u = new URL(url);
    if (u.hostname === "firebasestorage.googleapis.com") {
      const prefix = `/v0/b/${bucket}/o/`;
      if (u.pathname.startsWith(prefix)) {
        return decodeURIComponent(u.pathname.slice(prefix.length));
      }
    } else if (u.hostname === "storage.googleapis.com") {
      const prefix = `/${bucket}/`;
      if (u.pathname.startsWith(prefix)) {
        return decodeURIComponent(u.pathname.slice(prefix.length));
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}
