// src/lib/storage/client/clientUploader.ts
//
// directStorageClient の上位レイヤーとして、
// - UUID 付きパス生成
// - 進捗通知
// - キャンセル
// を備えたアップロード専用クライアントです。

"use client";

import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { uuidv7 } from "uuidv7";

import { storage } from "@/lib/firebase/client/app";

export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

export type UploadOptions = {
  /** Firebase Storage 内の保存ディレクトリ (例: "uploads/demo") */
  basePath: string;
  /** 任意のファイル名（省略時は UUID + 拡張子） */
  fileName?: string;
  /** 進捗通知 */
  onProgress?: (progress: UploadProgress) => void;
  /** 成功時の通知 */
  onComplete?: (result: { url: string; path: string }) => void;
  /** エラー時の通知 */
  onError?: (error: Error) => void;
};

export type UploadTaskHandle = {
  cancel: () => void;
};

export const clientUploader = {
  /**
   * Firebase Storage にアップロード（進捗取得・キャンセル対応）
   */
  upload: (file: File | Blob, options: UploadOptions): UploadTaskHandle => {
    const { basePath, fileName, onProgress, onComplete, onError } = options;
    const ext = "name" in file && file.name.includes(".") ? file.name.substring(file.name.lastIndexOf(".")) : "";
    const objectName = fileName ?? `${uuidv7()}${ext}`;
    const path = `${basePath}/${objectName}`;

    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      "state_changed",
      (snapshot) => {
        const loaded = snapshot.bytesTransferred;
        const total = snapshot.totalBytes || 1;
        const percent = Math.round((loaded / total) * 100);
        onProgress?.({ loaded, total, percent });
      },
      (err) => {
        onError?.(err);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        onComplete?.({ url, path });
      },
    );

    return {
      cancel: () => task.cancel(),
    };
  },
};
