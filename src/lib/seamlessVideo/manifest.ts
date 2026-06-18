// src/lib/seamlessVideo/manifest.ts
//
// 連結リール(映像+音声フラグメント列)を永続化・共有するためのマニフェスト。
// 各フラグメントの実体は Storage 等の公開 URL として持つ(Blob ではなく文字列)。
// 保存(クライアント)・格納(サーバー)・再生(クライアント)の三者で共有する型。

import type { ReelFragment } from "./types";

export type ReelManifestFragment = {
  /** 映像の公開 URL */
  video: string;
  /** 音声の公開 URL(省略時はそのフラグメントは無音) */
  audio?: string;
};

export type ReelManifest = {
  version: 1;
  /** 作成時刻(ISO 文字列)。呼び出し側で生成して渡す */
  createdAt: string;
  fragments: ReelManifestFragment[];
};

/** マニフェストを組み立てる。createdAtISO は呼び出し側で `new Date().toISOString()` 等を渡す。 */
export function buildReelManifest(fragments: ReelManifestFragment[], createdAtISO: string): ReelManifest {
  return { version: 1, createdAt: createdAtISO, fragments };
}

/** 任意の値をマニフェストとして検証・正規化する。不正なら null。 */
export function parseReelManifest(input: unknown): ReelManifest | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  if (obj.version !== 1) return null;
  if (!Array.isArray(obj.fragments) || obj.fragments.length === 0) return null;

  const fragments: ReelManifestFragment[] = [];
  for (const f of obj.fragments) {
    if (!f || typeof f !== "object") return null;
    const fo = f as Record<string, unknown>;
    if (typeof fo.video !== "string" || fo.video.length === 0) return null;
    const fragment: ReelManifestFragment = { video: fo.video };
    if (typeof fo.audio === "string" && fo.audio.length > 0) fragment.audio = fo.audio;
    fragments.push(fragment);
  }

  const createdAt = typeof obj.createdAt === "string" ? obj.createdAt : "";
  return { version: 1, createdAt, fragments };
}

/** マニフェストを再生用 ReelFragment[] に変換(URL は SeamlessFragmentSource としてそのまま使える)。 */
export function manifestToFragments(manifest: ReelManifest): ReelFragment[] {
  return manifest.fragments.map((f) => ({ video: f.video, audio: f.audio }));
}
