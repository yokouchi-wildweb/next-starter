// src/lib/storage/server/port.ts
//
// ストレージエンジンの境界（StoragePort）。実装は GCS の 1 つ（gcs.ts）と、テスト用の fake（fake.ts）。
// 判定（誰が・何を）はこの層に持たせない。呼び出し側（features/core/storageObject）が認可してから使う。
//
// 実装が守る約束:
// - issuePut / issueSession / put / copy は、Content-Disposition を contentTypes.ts の contentDispositionFor で決めて
//   オブジェクトの metadata に付ける（呼び出し側からは指定させない）
// - issuePut / issueSession で作られるオブジェクトの Cache-Control は no-store 固定。
//   公開ファイルは commit の照合後に setCacheControl で、その generation だけを長期 cache にする
// - 書き込み先は ifGenerationMatch:0（既存オブジェクトがあれば失敗 = 上書き不可）
// - generation を受ける操作は、指定があればその世代だけを対象にする
// - read は maxBytes を超えるオブジェクトを読み込む前に失敗させる（StorageReadTooLargeError）
//
// metadata: "strip" の用途の描き直し（features/core/storageObject）は、受け取った原本を read で読み、
// 処理後の物を put で本来の位置に書き、原本を delete で消す（専用の書き込み・削除は持たない）

import "server-only";

import { createGcsStoragePort } from "./gcs";

export type ObjectLocation = { bucket: string; path: string };

export type HeadResult = {
  size: number;
  contentType: string | null;
  generation: string;
};

export type IssuePutOptions = {
  contentType: string;
  /** 申告されたサイズ（バイト） */
  size: number;
  /** 用途の上限（バイト）。署名にサイズの範囲として含める */
  maxBytes: number;
  ttlSec: number;
};

export type IssuedPut = {
  url: string;
  /** ブラウザが PUT にそのまま付けるヘッダー（署名に含まれている） */
  headers: Record<string, string>;
  expiresAt: Date;
};

export type IssueSessionOptions = {
  contentType: string;
  size: number;
  /** ブラウザの Origin（GCS のセッションは開始時の Origin にだけ CORS を返す） */
  origin?: string;
};

export type IssuedSession = {
  sessionUrl: string;
};

export type PutOptions = {
  contentType: string;
  cacheControl: string;
};

export type CopyOptions = {
  cacheControl: string;
  /** コピー元の世代。指定すればその世代だけをコピーする */
  sourceGeneration?: string;
};

export type DeleteOptions = {
  /** 指定すればその世代だけを削除する（別の世代に置き換わっていれば何もしない） */
  generation?: string;
};

export type ReadOptions = {
  /** 指定すればその世代だけを読む */
  generation?: string;
  /** これを超えるサイズのオブジェクトは読み込まずに StorageReadTooLargeError */
  maxBytes: number;
};

/** read の対象が maxBytes を超えていた */
export class StorageReadTooLargeError extends Error {
  readonly size: number;
  readonly maxBytes: number;

  constructor(location: ObjectLocation, size: number, maxBytes: number) {
    super(`読み取りの上限を超えています（${size} > ${maxBytes}）: ${location.bucket}/${location.path}`);
    this.name = "StorageReadTooLargeError";
    this.size = size;
    this.maxBytes = maxBytes;
  }
}

export type SignReadOptions = {
  ttlSec: number;
  /** 指定すればその世代だけを読ませる */
  generation?: string;
  /** 応答の Content-Disposition。省略時は attachment（contentDispositionFor の結果を渡す） */
  responseDisposition?: string;
};

export interface StoragePort {
  /** 単発 PUT の署名 URL を発行する */
  issuePut(location: ObjectLocation, options: IssuePutOptions): Promise<IssuedPut>;
  /** 再開可能セッションを開始し、その URI を返す（URI 自体がアップロード権になる） */
  issueSession(location: ObjectLocation, options: IssueSessionOptions): Promise<IssuedSession>;
  /** 再開可能セッションを中止し、URI を使えなくする（無い・完了済み・中止済みも成功扱い） */
  cancelSession(sessionUrl: string): Promise<void>;
  /** オブジェクトの実体情報。無ければ null */
  head(location: ObjectLocation): Promise<HeadResult | null>;
  /** 指定した世代の Cache-Control を書き換える */
  setCacheControl(location: ObjectLocation, generation: string, value: string): Promise<void>;
  /** 中身をサーバーに読み込む（無い・指定の世代が無ければ失敗） */
  read(location: ObjectLocation, options: ReadOptions): Promise<Uint8Array>;
  /** サーバーから直接書き込む */
  put(location: ObjectLocation, body: Uint8Array, options: PutOptions): Promise<HeadResult>;
  /** 複製する（宛先は既存オブジェクトがあれば失敗） */
  copy(source: ObjectLocation, destination: ObjectLocation, options: CopyOptions): Promise<HeadResult>;
  /** 削除する（存在しない場合も成功扱い） */
  delete(location: ObjectLocation, options?: DeleteOptions): Promise<void>;
  /** 読み取り用の短期署名 URL */
  signRead(location: ObjectLocation, options: SignReadOptions): Promise<string>;
}

/** 発行直後のオブジェクトに付ける Cache-Control（固定） */
export const ISSUED_CACHE_CONTROL = "no-store";

let overridePort: StoragePort | null = null;
let defaultPort: StoragePort | null = null;

/** 現在のポート。テストで差し替えていればそれ、無ければ GCS 実装（初回呼び出し時に作る） */
export function getStoragePort(): StoragePort {
  if (overridePort) return overridePort;
  defaultPort ??= createGcsStoragePort();
  return defaultPort;
}

/** テスト用の差し替え口。fake.ts の __setStoragePortForTest から使う。null で元に戻す */
export function setStoragePortOverride(port: StoragePort | null): void {
  overridePort = port;
}
