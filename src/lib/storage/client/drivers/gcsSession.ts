// src/lib/storage/client/drivers/gcsSession.ts
//
// GCS の再開可能セッションのドライバー。サーバーが開始したセッション URI へ、chunk ごとに Content-Range を付けて送る。
// - 途中の chunk は 308（Resume Incomplete）、最後の chunk は 200 / 201
// - 通信が途切れたら `bytes */<total>` で状態を照会し、Range ヘッダーの続きから再開する（回数に上限あり）
// - GCS が再試行を勧める応答（408 / 429 / 5xx の一部）は、少し待ってから同じく照会して続きから送る。
//   待ち時間は 1s・2s・4s の指数 + 0〜500ms の揺らぎ。通信の途切れと合わせて連続 3 回まで（前進すれば数え直す）
// - それ以外の応答のある失敗（4xx など）は再試行しない
// - 中止は送信を止めるだけ。セッション URI の中止（DELETE）は、取り消し（discard）を受けたサーバーが行う
// 宣言した長さ・上書き不可（ifGenerationMatch:0）・型は、サーバーがセッションを開始したときの条件で GCS が強制する。

"use client";

import axios, { type AxiosInstance } from "axios";

import type { UploadProgress } from "../transferTypes";

/** chunk の大きさ（GCS の要件: 最後以外は 256KiB の倍数） */
export const SESSION_CHUNK_BYTES = 8 * 1024 * 1024;
const MAX_RESUME_ATTEMPTS = 3;
/** 再試行する応答の状態（GCS の再試行の推奨に合わせる） */
export const SESSION_RETRYABLE_STATUSES: readonly number[] = [408, 429, 500, 502, 503, 504];
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_JITTER_MS = 500;

/** n 回目（1 始まり）の再試行までの待ち時間（ミリ秒） */
export function sessionRetryDelayMs(attempt: number, random: () => number = Math.random): number {
  return RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) + Math.floor(random() * RETRY_JITTER_MS);
}

export type SessionTransferOptions = {
  sessionUrl: string;
  body: Blob;
  signal: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
  chunkBytes?: number;
  /** 再試行までの待ち時間（テスト用に差し替える。既定 sessionRetryDelayMs） */
  retryDelayMs?: (attempt: number) => number;
};

/** 中止できる待ち。中止されたら axios の中止と同じ CanceledError で終わる */
function waitFor(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new axios.CanceledError());
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new axios.CanceledError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** 再試行する失敗か。応答の無い通信の途切れ、または再試行を勧める状態の応答 */
function isRetryableFailure(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  if (!error.response) return true;
  return SESSION_RETRYABLE_STATUSES.includes(error.response.status);
}

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

  /**
   * 再試行できる失敗なら（応答のある失敗は待ってから）受け取り済みの位置を照会して返す。完了していれば null。
   * 照会自体が再試行できる失敗で終わったら、同じ連続失敗の上限の中で照会をやり直す
   */
  const recover = async (error: unknown): Promise<number | null> => {
    let current = error;
    for (;;) {
      if (axios.isCancel(current) || options.signal.aborted) throw current;
      if (!isRetryableFailure(current)) throw current;
      failures += 1;
      if (failures > MAX_RESUME_ATTEMPTS) throw current;
      // 応答のある失敗は待ってから照会する（通信の途切れはすぐ照会する）
      if (axios.isAxiosError(current) && current.response) {
        await waitFor((options.retryDelayMs ?? sessionRetryDelayMs)(failures), options.signal);
      }
      try {
        return await queryOffset();
      } catch (queryError) {
        current = queryError;
      }
    }
  };

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
      const resumed = await recover(error);
      if (resumed === null) {
        report(total);
        return;
      }
      if (resumed > offset) failures = 0;
      offset = resumed;
    }
  }
}
