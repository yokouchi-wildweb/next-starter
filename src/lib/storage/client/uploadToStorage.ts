// src/lib/storage/client/uploadToStorage.ts
//
// ファイルを用途（purpose）にアップロードする。
//   (画像の描き直し) → アップロード権の発行 → 種類に合うドライバーで GCS へ直接送る → commit
// 中止・失敗のときは、発行済みなら取り消し（discard）を試みる（session はサーバーが URI を中止する）。
// セッション送信は通信の途切れと GCS の 408 / 429 / 5xx を連続 3 回まで再試行する（drivers/gcsSession.ts）。単発 PUT は再試行しない。
// 中止は onError に code "storage/canceled" の StorageUploadError を渡す（旧クライアントと同じコード）。
//
//   const { cancel } = uploadToStorage(file, {
//     purpose: "user.avatar",
//     onProgress: ({ percent }) => setPercent(percent),
//     onComplete: ({ ref, src }) => setValue(ref),
//     onError: (error) => isStorageUploadCanceled(error) || toast.error(error.message),
//   });

"use client";

import axios, { type AxiosInstance } from "axios";

import { normalizeHttpError } from "@/lib/errors";

import { putTransfer } from "./drivers/put";
import { sessionTransfer } from "./drivers/gcsSession";
import { browserImageCodec, reencodeImage, type ImageCodec } from "./reencodeImage";
import { createStorageClient, type StorageClient } from "./storageClient";
import {
  StorageUploadError,
  type UploadedFile,
  type UploadProgress,
  type UploadTaskHandle,
} from "./transferTypes";

export type UploadToStorageOptions = {
  /** ファイル用途 ID（`<domain>.<field>`） */
  purpose: string;
  /** 用途の判定に使う範囲（チャットのルーム ID・振込依頼 ID など） */
  scopeId?: string | null;
  /** 画像を描き直して EXIF を落とすか（既定 true。jpeg / png / webp だけが対象） */
  reencodeImage?: boolean;
  onProgress?: (progress: UploadProgress) => void;
  onComplete?: (result: UploadedFile) => void;
  onError?: (error: Error) => void;
};

export type UploaderDeps = {
  client: StorageClient;
  /** GCS への直接転送に使う axios（アプリの Cookie を送らない） */
  transferHttp: AxiosInstance;
  codec: ImageCodec;
  /** セッション送信の再試行までの待ち時間（テスト用。既定は drivers/gcsSession の sessionRetryDelayMs） */
  sessionRetryDelayMs?: (attempt: number) => number;
};

export function createUploader(deps: UploaderDeps) {
  return function upload(file: Blob, options: UploadToStorageOptions): UploadTaskHandle {
    const controller = new AbortController();
    let objectId: string | null = null;
    let canceled = false;

    const discardQuietly = async () => {
      if (!objectId) return;
      try {
        await deps.client.discard(objectId);
      } catch (error) {
        console.error("[storage] 取り消しに失敗しました（未採用のファイルは掃除で消えます）", error);
      }
    };

    const run = async () => {
      const body = options.reencodeImage === false ? file : await reencodeImage(file, deps.codec);
      if (canceled) throw new StorageUploadError("storage/canceled", "アップロードを中止しました");

      const issued = await deps.client.issue({
        purpose: options.purpose,
        contentType: body.type || "application/octet-stream",
        size: body.size,
        scopeId: options.scopeId ?? undefined,
      });
      objectId = issued.objectId;
      if (canceled) throw new StorageUploadError("storage/canceled", "アップロードを中止しました");

      try {
        if (issued.transfer.kind === "put") {
          await putTransfer(deps.transferHttp, {
            url: issued.transfer.url,
            headers: issued.transfer.headers,
            body,
            signal: controller.signal,
            onProgress: options.onProgress,
          });
        } else {
          await sessionTransfer(deps.transferHttp, {
            sessionUrl: issued.transfer.sessionUrl,
            body,
            signal: controller.signal,
            onProgress: options.onProgress,
            retryDelayMs: deps.sessionRetryDelayMs,
          });
        }
      } catch (error) {
        if (canceled || axios.isCancel(error)) {
          throw new StorageUploadError("storage/canceled", "アップロードを中止しました", { cause: error });
        }
        throw normalizeHttpError(error, "ファイルの送信に失敗しました");
      }

      const committed = await deps.client.commit(issued.objectId);
      return { ref: committed.ref, objectId: issued.objectId, src: committed.src };
    };

    run().then(
      (result) => options.onComplete?.(result),
      async (error: unknown) => {
        await discardQuietly();
        const normalized =
          error instanceof StorageUploadError
            ? error
            : error instanceof Error
              ? error
              : new StorageUploadError("storage/failed", "アップロードに失敗しました", { cause: error });
        options.onError?.(normalized);
      },
    );

    return {
      cancel: () => {
        canceled = true;
        controller.abort();
      },
    };
  };
}

/** GCS への直接転送用（既定の axios とは分け、Cookie を送らない） */
const transferHttp = axios.create({ withCredentials: false });

export const uploadToStorage = createUploader({
  client: createStorageClient(),
  transferHttp,
  codec: browserImageCodec,
});
