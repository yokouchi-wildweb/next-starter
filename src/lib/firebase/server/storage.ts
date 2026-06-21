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
 * 読み取り用の署名付き URL を払い出す（サーバー用）。
 *
 * フルダウンロードせず Range で部分取得したい用途（メディア解析 probe 等）に使う。
 * Admin SDK のサービスアカウント鍵でオフライン V4 署名するため、追加の権限設定は不要。
 *
 * @param path - Storage 内のパス
 * @param ttlSec - 有効期限（秒）。既定 120 秒
 * @returns 署名付き読み取り URL
 */
export async function getReadSignedUrl(path: string, ttlSec = 120): Promise<string> {
  const bucket = getServerStorage().bucket();
  const [url] = await bucket.file(path).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + ttlSec * 1000,
  });
  return url;
}

/**
 * Storage オブジェクトのメタデータ（サイズ・Content-Type）を取得する（サーバー用）。
 *
 * @param path - Storage 内のパス
 * @returns sizeBytes / contentType（取得不能な項目は null）
 */
export async function getFileMetadata(
  path: string,
): Promise<{ sizeBytes: number | null; contentType: string | null }> {
  const bucket = getServerStorage().bucket();
  const [metadata] = await bucket.file(path).getMetadata();
  const size = metadata.size != null ? Number(metadata.size) : null;
  return {
    sizeBytes: size != null && Number.isFinite(size) ? size : null,
    contentType: metadata.contentType ?? null,
  };
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
