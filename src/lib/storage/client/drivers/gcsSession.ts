// src/lib/storage/client/drivers/gcsSession.ts
//
// GCS の再開可能セッションのドライバー。サーバーが開始したセッション URI へ、chunk ごとに Content-Range を付けて送る。
// - 途中の chunk は 308（Resume Incomplete）、最後の chunk は 200 / 201
// - 通信が途切れたら `bytes */<total>` で状態を照会し、Range ヘッダーの続きから再開する（回数に上限あり）
// - 中止は送信を止めるだけ。セッション URI の中止（DELETE）は、取り消し（discard）を受けたサーバーが行う
// 宣言した長さ・上書き不可（ifGenerationMatch:0）・型は、サーバーがセッションを開始したときの条件で GCS が強制する。

"use client";

import axios, { type AxiosInstance } from "axios";

import type { UploadProgress } from "../transferTypes";

/** chunk の大きさ（GCS の要件: 最後以外は 256KiB の倍数） */
export const SESSION_CHUNK_BYTES = 8 * 1024 * 1024;
const MAX_RESUME_ATTEMPTS = 3;

export type SessionTransferOptions = {
  sessionUrl: string;
  body: Blob;
  signal: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
  chunkBytes?: number;
};

const okOrIncomplete = (status: number) => status === 308 || (status >= 200 && status < 300);

/** 308 の Range ヘッダー（bytes=0-N）から、次に送る位置を読む。Range が無ければ 0 */
export function nextOffsetFromRange(range: string | undefined | null): number {
  const match = /bytes=0-(\d+)/.exec(range ?? "");
  return match ? Number(match[1]) + 1 : 0;
}

export async function sessionTransfer(http: AxiosInstance, options: SessionTransferOptions): Promise<void> {
  const total = options.body.size;
  const chunkBytes = options.chunkBytes ?? SESSION_CHUNK_BYTES;
  const report = (loaded: number) =>
    options.onProgress?.({ loaded, total, percent: total > 0 ? Math.round((loaded / total) * 100) : 100 });

  /** サーバーが受け取り済みのバイト数を照会する。完了していれば null */
  const queryOffset = async (): Promise<number | null> => {
    const res = await http.put(options.sessionUrl, null, {
      headers: { "Content-Range": `bytes */${total}` },
      signal: options.signal,
      withCredentials: false,
      validateStatus: okOrIncomplete,
    });
    if (res.status !== 308) return null;
    return nextOffsetFromRange(res.headers?.range as string | undefined);
  };

  let offset = 0;
  let failures = 0;
  while (offset < total || total === 0) {
    const end = total === 0 ? 0 : Math.min(offset + chunkBytes, total);
    const chunk = options.body.slice(offset, end);
    const contentRange = total === 0 ? `bytes */0` : `bytes ${offset}-${end - 1}/${total}`;
    try {
      const res = await http.put(options.sessionUrl, chunk, {
        headers: { "Content-Range": contentRange },
        signal: options.signal,
        withCredentials: false,
        validateStatus: okOrIncomplete,
        onUploadProgress: (event) => report(offset + (event.loaded ?? 0)),
      });
      if (res.status !== 308) {
        report(total);
        return;
      }
      offset = nextOffsetFromRange(res.headers?.range as string | undefined);
      failures = 0;
      report(offset);
    } catch (error) {
      if (axios.isCancel(error) || options.signal.aborted) throw error;
      // 応答のある失敗（4xx / 5xx）は再開しない。通信の途切れだけを照会して再開する
      if (axios.isAxiosError(error) && error.response) throw error;
      failures += 1;
      if (failures > MAX_RESUME_ATTEMPTS) throw error;
      const resumed = await queryOffset();
      if (resumed === null) {
        report(total);
        return;
      }
      offset = resumed;
    }
  }
}
