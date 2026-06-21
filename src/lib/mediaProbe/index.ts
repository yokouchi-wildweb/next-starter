// src/lib/mediaProbe/index.ts
//
// サーバーサイド メディア解析（probe）capability のエントリ（server-only）。
// このモジュールを import した時点で既定エンジン（mediainfo / WASM）が登録される。
// 詳細・設計は README.md を参照。

import { mediainfoEngine } from "./server/engine/mediainfoEngine";
import { registerProbeEngine } from "./server/registry";

// 既定エンジンを登録（フォーク側は setDefaultProbeEngine / registerProbeEngine で差し替え可）
registerProbeEngine(mediainfoEngine, { makeDefault: true });

export { probeMedia, type ProbeOptions } from "./server/probeMedia";
export {
  registerProbeEngine,
  setDefaultProbeEngine,
  getProbeEngine,
  listProbeEngines,
} from "./server/registry";
export type { ProbeEngine, MediaSource } from "./server/engine/types";
export { ProbeEngineError } from "./server/engine/types";

export type {
  MediaRef,
  ProbeResult,
  ProbeSuccess,
  ProbeFailure,
  ProbeFacts,
  ProbeErrorCode,
  ProbeVideoInfo,
  ProbeAudioInfo,
} from "./types";

export { hasAudioTrack, hasVideoTrack, isSilentVideo, isAudioOnly } from "./assertions";
