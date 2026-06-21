// src/lib/mediaProbe/server/probeMedia.ts
//
// probe capability のオーケストレータ。
// MediaRef → MediaSource → エンジン解析 → ProbeResult を、エンジン非依存に組み立てる。
// 想定内の失敗（取得不可・非対応・解析失敗・タイムアウト）は throw せず ProbeFailure を返す。

import type { MediaRef, ProbeResult } from "../types";
import type { ProbeEngine } from "./engine/types";
import { ProbeEngineError } from "./engine/types";
import { createMediaSource } from "./mediaSource";
import { getProbeEngine } from "./registry";

export type ProbeOptions = {
  /** 使用するエンジン（実体 or 登録名）。省略時は既定エンジン。 */
  engine?: ProbeEngine | string;
  /** 解析全体のタイムアウト（ms）。既定 10000。 */
  timeoutMs?: number;
  /** 署名付き URL の有効期限（秒）。既定 120。 */
  signedUrlTtlSec?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_SIGNED_URL_TTL_SEC = 120;

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(`メディア解析がタイムアウトしました (${timeoutMs}ms)`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function toFailure(e: unknown): ProbeResult {
  if (e instanceof TimeoutError) {
    return { ok: false, error: { code: "timeout", message: e.message } };
  }
  if (e instanceof ProbeEngineError) {
    return { ok: false, error: { code: e.code, message: e.message } };
  }
  const message = e instanceof Error ? e.message : String(e);
  return { ok: false, error: { code: "probe_failed", message } };
}

/**
 * ストレージ上のメディアを解析し、ストリーム構成（音声トラックの有無等）を返す。
 *
 * @param ref - 解析対象（storagePath 推奨 / downloadUrl）
 * @param opts - エンジン・タイムアウト・署名 URL 有効期限
 * @returns ProbeResult（ok=false は取得/解析の失敗。事実としての「音声あり」は ok=true）
 */
export async function probeMedia(ref: MediaRef, opts: ProbeOptions = {}): Promise<ProbeResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const signedUrlTtlSec = opts.signedUrlTtlSec ?? DEFAULT_SIGNED_URL_TTL_SEC;

  try {
    const engine = getProbeEngine(opts.engine);
    const source = await createMediaSource(ref, signedUrlTtlSec);
    const facts = await withTimeout(engine.probe(source), timeoutMs);
    return { ok: true, ...facts };
  } catch (e) {
    return toFailure(e);
  }
}
