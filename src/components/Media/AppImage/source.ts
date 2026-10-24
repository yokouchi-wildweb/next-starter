// src/components/Media/AppImage/source.ts
//
// AppImage が next/image に渡す src と unoptimized を決める純関数。
// storage:// の ref だけを表示用 URL にし、それ以外の値（旧 URL・"/" 始まり・blob: / data: の
// プレビュー等）は従来どおりそのまま渡す（toStorageDisplaySrc。overlays と同じ規則）。
// 非公開ファイルの固定 URL（/api/storage/）は呼び出し側の指定に関わらず unoptimized。

import { isPrivateObjectPath, toStorageDisplaySrc } from "@/lib/storage/ref";

import { isOptimizableSrc } from "./optimizable";

export type AppImageSourceInput = {
  src: string | null | undefined;
  fallbackSrc?: string;
  unoptimized?: boolean;
  /** src の読み込みに失敗した（onError 済み）なら true。fallbackSrc に切り替える */
  failed?: boolean;
};

export type AppImageSource = {
  /** next/image に渡す src。無ければ画像なしで描画する */
  displaySrc: string | undefined;
  unoptimized: boolean | undefined;
};

export function resolveAppImageSource(input: AppImageSourceInput): AppImageSource {
  const resolved = input.failed ? null : toStorageDisplaySrc(input.src);
  const displaySrc = resolved ?? toStorageDisplaySrc(input.fallbackSrc) ?? undefined;
  if (!displaySrc) return { displaySrc: undefined, unoptimized: undefined };

  // 認可済みの画像を最適化キャッシュに載せない（呼び出し側の unoptimized={false} でも外す）
  if (isPrivateObjectPath(displaySrc)) return { displaySrc, unoptimized: true };
  return { displaySrc, unoptimized: input.unoptimized ?? !isOptimizableSrc(displaySrc) };
}
