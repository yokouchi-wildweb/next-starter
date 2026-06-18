// src/lib/seamlessVideo/core/fragmentBytes.ts
//
// 各種ソース表現(URL / Blob / ArrayBuffer / Uint8Array)を ArrayBuffer に正規化する。
// 連結再生コアと検証(probe)の双方で共有する。
// URL 文字列の場合のみ、任意の FragmentFetcher で取得方法を差し替えられる。

import { fetchStorageBytes } from "@/lib/storageCors";

import type { FragmentFetcher, SeamlessFragmentSource } from "../types";

/** SeamlessFragmentSource を appendBuffer / 解析に渡せる ArrayBuffer へ変換する。 */
export async function toArrayBuffer(
  source: SeamlessFragmentSource,
  fetcher?: FragmentFetcher,
): Promise<ArrayBuffer> {
  if (typeof source === "string") {
    if (fetcher) return fetcher(source);
    // 別ドメイン(Firebase Storage 等)の URL を取得する。CORS 未設定だとここで
    // TypeError(Failed to fetch) になるため、fetchStorageBytes 経由にして開発時に自己診断を出す。
    const res = await fetchStorageBytes(source);
    if (!res.ok) {
      throw new Error(`フラグメントの取得に失敗しました: ${source} (HTTP ${res.status})`);
    }
    return res.arrayBuffer();
  }
  if (source instanceof Blob) {
    return source.arrayBuffer();
  }
  if (source instanceof Uint8Array) {
    // 元バッファの一部ビュー / SharedArrayBuffer の可能性があるため、専有の ArrayBuffer にコピーする
    const copy = new Uint8Array(source.byteLength);
    copy.set(source);
    return copy.buffer;
  }
  // ArrayBuffer
  return source;
}
