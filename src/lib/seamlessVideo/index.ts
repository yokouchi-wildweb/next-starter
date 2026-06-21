// src/lib/seamlessVideo/index.ts
//
// 事前に統一プロファイルへ変換された fmp4 フラグメントを、MSE で 1 本の映像として
// 継ぎ目なく連結再生する汎用ライブラリ。変換(トランスコード)は責務外。
// 入力フォーマット規約は README.md を参照。

export type { SeamlessFragmentSource, FragmentInfo, ReelFragment, FragmentFetcher } from "./types";

// 連結再生コア(映像のみ) / フック / コンポーネント
export { SeamlessSource, type SeamlessSourceOptions } from "./core/SeamlessSource";
export {
  useSeamlessVideo,
  type UseSeamlessVideoOptions,
  type UseSeamlessVideoResult,
  type SeamlessStatus,
} from "./hooks/useSeamlessVideo";
export { SeamlessVideoPlayer, type SeamlessVideoPlayerProps } from "./components/SeamlessVideoPlayer";

// 音声付き連結(方式 B): 映像 MSE + 音声 Web Audio + A/V 同期
// AudioEngine はアプリ共通基盤 @/lib/webAudio へ移設(後方互換のため再エクスポート)
export { AudioEngine } from "@/lib/webAudio";
export { AudioReel, type AudioReelOptions } from "./core/AudioReel";
export {
  SeamlessReel,
  type SeamlessReelOptions,
  type SeamlessReelLoadOptions,
  type SeamlessReelState,
} from "./core/SeamlessReel";
export {
  useSeamlessReel,
  type UseSeamlessReelOptions,
  type UseSeamlessReelResult,
  type SeamlessReelStatus,
  type SeamlessReelLoaded,
} from "./hooks/useSeamlessReel";

// 再生前の先読み(キャッシュ温め)
export { prefetchFragments, prefetchManifest } from "./core/prefetch";

// 環境サポート判定
export { isMseSupported, isTypeSupported, getMediaSourceCtor, isManagedMediaSource } from "./core/codecSupport";

// フォーマット検証(probe)
export { parseFragment, parseFragmentSafe } from "./probe/boxWalker";
export {
  validateFragments,
  type FragmentInput,
  type FragmentValidation,
  type ValidationReport,
} from "./probe/validateFragments";
export {
  validateReel,
  type ReelFragmentInput,
  type ReelFragmentValidation,
  type ReelValidationReport,
} from "./probe/validateReel";
export { formatValidationReport, formatReelValidationReport } from "./probe/formatReport";

// 連結リールの永続化・共有(マニフェスト)
// ※ server/reelManifestStore はサーバー専用のため、ここでは再エクスポートしない
export {
  buildReelManifest,
  parseReelManifest,
  manifestToFragments,
  type ReelManifest,
  type ReelManifestFragment,
} from "./manifest";
export { reelManifestClient } from "./client/reelManifestClient";
