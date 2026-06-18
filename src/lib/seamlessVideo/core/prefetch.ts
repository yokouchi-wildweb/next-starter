// src/lib/seamlessVideo/core/prefetch.ts
//
// 再生前にフラグメントを先読みして HTTP キャッシュを温めるユーティリティ。
// 例: ガチャの「引く」前に当選候補のアセットを温めておくと、再生開始がほぼ即時になる。
// 取得済みファイルは immutable キャッシュされるため、後続の実再生は遅延なくキャッシュヒットする。
//
// メモリ方針(重要): この関数は取得した ArrayBuffer を保持しない(取得後に破棄)。
// 実体のキャッシュは「ブラウザの HTTP キャッシュ」であり、容量上限・破棄(LRU)はブラウザが管理する。
// したがって、当選候補を多数先読みしても本ライブラリ側でメモリが肥大することはない。
// (デコード済みを保持して即再生したい場合は、これとは別に明示的な上限付きキャッシュを用意すること)

import type { FragmentFetcher, SeamlessFragmentSource } from "../types";
import type { ReelManifest } from "../manifest";
import { toArrayBuffer } from "./fragmentBytes";

/** 複数ソースを並列に先読みする(個別の失敗は無視)。 */
export async function prefetchFragments(
  sources: SeamlessFragmentSource[],
  fetcher?: FragmentFetcher,
): Promise<void> {
  await Promise.allSettled(sources.map((s) => toArrayBuffer(s, fetcher)));
}

/** マニフェスト(映像+音声 URL)をまとめて先読みする。 */
export async function prefetchManifest(manifest: ReelManifest, fetcher?: FragmentFetcher): Promise<void> {
  const urls: SeamlessFragmentSource[] = [];
  for (const f of manifest.fragments) {
    urls.push(f.video);
    if (f.audio) urls.push(f.audio);
  }
  await prefetchFragments(urls, fetcher);
}
