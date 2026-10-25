// src/lib/storage/client/uploadToStorage.ts
//
// ファイルを用途（purpose）にアップロードする。
//   (HEIC など: 用途の方針を確かめ、strip なら JPEG に / 任意の描き直し) → アップロード権の発行 → 種類に合うドライバーで GCS へ直接送る → commit
// 中止・失敗のときは、発行済みなら取り消し（discard）を試みる（session はサーバーが URI を中止する）。
// セッション送信は通信の途切れと GCS の 408 / 429 / 5xx を連続 3 回まで再試行する（drivers/gcsSession.ts）。単発 PUT は再試行しない。
// 中止は onError に code "storage/canceled" の StorageUploadError を渡す（旧クライアントと同じコード）。
// 位置情報などの除去の保証はサーバー（strip の用途の画像は commit で描き直される）。端末は用途の宣言を推測せず、
// サーバーが描き直せない画像（HEIC など）を選んだときだけ用途の方針をサーバーに問い合わせる（purposePolicy.ts。用途ごとに記憶）。
// 呼び出し側は strip / keep を指定しない。
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
import { needsClientConversion, prepareStripImage, withInferredImageType } from "./prepareStripImage";
import { createPurposeMetadataLoader, purposeMetadataLoader, type PurposeMetadataLoader } from "./purposePolicy";
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
  /**
   * 送る前にブラウザで画像を描き直すか（既定 false。jpeg / png / webp だけが対象）。
   * 通信量を減らすための任意の前処理で、位置情報の除去の保証には数えない（保証はサーバー）
   */
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
  /** 用途の方針の取得と記憶（省略 = client から作る。アプリは usePurposeMetadata と共有の記憶を渡す） */
  purposeMetadata?: PurposeMetadataLoader;
  /** セッション送信の再試行までの待ち時間（テスト用。既定は drivers/gcsSession の sessionRetryDelayMs） */
  sessionRetryDelayMs?: (attempt: number) => number;
};

/**
 * 送る本体。サーバーが描き直せない画像（HEIC など）のときだけ用途の方針を確かめる:
 * - strip: 端末で JPEG にする（開けなければ発行の前に "storage/unsupported-image"）。変換した物には任意の描き直しを重ねない
 * - keep: 変換しない（型が空の .heic / .heif は image/heic・image/heif として申告する）
 * - 方針を得られない: 変換しない（keep の用途を誤って変えない側。strip の用途ならサーバーが発行を 400 で拒否する）
 */
async function prepareBody(
  file: Blob,
  options: UploadToStorageOptions,
  codec: ImageCodec,
  purposeMetadata: PurposeMetadataLoader,
): Promise<Blob> {
  if (needsClientConversion(file)) {
    const metadata = await purposeMetadata.load(options.purpose).catch(() => null);
    if (metadata === "strip") return prepareStripImage(file, codec);
    return withInferredImageType(file);
  }
  return options.reencodeImage === true ? reencodeImage(file, codec) : file;
}

export function createUploader(deps: UploaderDeps) {
  const purposeMetadata = deps.purposeMetadata ?? createPurposeMetadataLoader(deps.client);

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
      const body = await prepareBody(file, options, deps.codec, purposeMetadata);
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
  purposeMetadata: purposeMetadataLoader,
});
