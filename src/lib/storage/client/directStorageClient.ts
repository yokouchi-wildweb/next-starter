// src/lib/storage/client/directStorageClient.ts
//
// NOTE: このモジュールは Firebase Storage SDK を直接操作するための低レイヤーラッパーです。
//       アプリ共通のアップロード API やパス生成などを提供する src/lib/storage とは責務が異なります。
//       UI 層やドメイン機能からは基本的に src/lib/storage 経由で利用し、
//       Firebase SDK と直接やり取りする必要がある特殊なケースのみ、このモジュールを参照してください。
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase/client/app";

export const directStorageClient = {
  /**
   * Firebase Storage にファイルをアップロードする（ブラウザ用）
   *
   * @param path - Firebase Storage 内の保存パス
   * @param file - アップロードする Blob または File
   * @returns アップロード後のダウンロード URL
   */
  upload: async (path: string, file: Blob | File): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  },

  /**
   * Firebase Storage のファイルを削除する（ブラウザ用）
   *
   * @param path - Firebase Storage 内のパス
   */
  remove: async (path: string): Promise<void> => {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  },
};

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
