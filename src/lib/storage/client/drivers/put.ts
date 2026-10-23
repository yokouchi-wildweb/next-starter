// src/lib/storage/client/drivers/put.ts
//
// 単発 PUT のドライバー。サーバーが発行した署名 URL へ、署名に含めたヘッダーをそのまま付けて 1 回で送る。
// 上書き不可（if-generation-match:0）・サイズ上限（content-length-range）・型は署名で GCS が強制する。
// 転送も axios で行う（ブラウザでは XHR になり、onUploadProgress で進捗、AbortSignal で中止できる）。

"use client";

import type { AxiosInstance } from "axios";

import type { UploadProgress } from "../transferTypes";

export type PutTransferOptions = {
  url: string;
  headers: Record<string, string>;
  body: Blob;
  signal: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
};

export async function putTransfer(http: AxiosInstance, options: PutTransferOptions): Promise<void> {
  const total = options.body.size;
  await http.put(options.url, options.body, {
    headers: options.headers,
    signal: options.signal,
    // アプリの Cookie を GCS へ送らない
    withCredentials: false,
    onUploadProgress: (event) => {
      const loaded = event.loaded ?? 0;
      options.onProgress?.({ loaded, total, percent: total > 0 ? Math.round((loaded / total) * 100) : 100 });
    },
  });
}
