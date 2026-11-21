// src/lib/mediaProbe/index.ts
//
// 入口 ".": メディア解析(probe)の結果の型と、結果の形の判定(client でも server でも読める)。
// 解析の本体・エンジンの登録は入口 "./server"(server/index.ts、server-only)。詳細・設計は README.md。

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
