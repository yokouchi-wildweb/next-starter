// src/lib/seamlessVideo/core/prefetch.ts
//
// 再生前にフラグメントを先読みして HTTP キャッシュを温めるユーティリティ。
// 例: ガチャの「引く」前に当選候補のアセットを温めておくと、再生開始がほぼ即時になる。
// 取得済みファイルは immutable キャッシュされるため、後続の実再生は遅延なくキャッシュヒットする。

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
