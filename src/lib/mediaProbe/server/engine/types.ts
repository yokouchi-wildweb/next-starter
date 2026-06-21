// src/lib/mediaProbe/server/engine/types.ts
//
// probe エンジンの差し替え可能インターフェース。
// 「中をどう覗くか（WASM / ffprobe バイナリ / 外部サービス）」を抽象化し、
// 契約（ProbeFacts）を変えずに実装を入れ替えられるようにする。

import type { ProbeErrorCode, ProbeFacts } from "../../types";

/**
 * 「バイトの取り方」を抽象化したメディアソース。
 * - url を直接扱えるエンジン（ffprobe バイナリ等）は url を使う
 * - バイト列を必要とするエンジン（WASM 等）は readChunk で Range 取得する
 * いずれもフルダウンロードを強制しない。
 */
export interface MediaSource {
  /** 署名付き読み取り URL。生成不能なら null */
  readonly url: string | null;
  /** 総バイト数。判明していなければ null */
  readonly sizeBytes: number | null;
  readonly contentType: string | null;
  /** [offset, offset+length) のバイトを取得する（Range リクエスト）。 */
  readChunk(offset: number, length: number): Promise<Uint8Array>;
}

/** probe エンジン。name で登録・選択する。 */
export interface ProbeEngine {
  readonly name: string;
  /**
   * メディアを解析して事実（ProbeFacts）を返す。
   * 取得不能・非対応・解析失敗は {@link ProbeEngineError} を throw する
   * （オーケストレータが ProbeFailure へマップする）。
   */
  probe(source: MediaSource): Promise<ProbeFacts>;
}

/** エンジンが投げる、コード付きのエラー。オーケストレータが ProbeErrorCode へ伝播する。 */
export class ProbeEngineError extends Error {
  readonly code: ProbeErrorCode;
  constructor(code: ProbeErrorCode, message: string) {
    super(message);
    this.name = "ProbeEngineError";
    this.code = code;
  }
}
