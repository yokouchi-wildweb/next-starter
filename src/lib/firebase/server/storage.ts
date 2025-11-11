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
  await file.save(buffer, { contentType });
  await file.makePublic();
  return file.publicUrl();
}

export async function deleteFileServer(path: string): Promise<void> {
  const bucket = getServerStorage().bucket();
  const file = bucket.file(path);
  await file.delete();
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
