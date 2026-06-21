// src/lib/mediaProbe/assertions.ts
//
// ProbeResult に対する汎用述語ヘルパ。
// 「事実の形」だけを判定する（背景動画/BGM 等の用途名への紐付けは消費側ドメインの責務）。

import type { ProbeResult } from "./types";

/** 解析に成功し、音声トラックを含むか。 */
export function hasAudioTrack(result: ProbeResult): boolean {
  return result.ok && result.hasAudioTrack;
}

/** 解析に成功し、映像トラックを含むか。 */
export function hasVideoTrack(result: ProbeResult): boolean {
  return result.ok && result.hasVideoTrack;
}

/** 映像を含み、かつ音声を含まない（無音動画）か。 */
export function isSilentVideo(result: ProbeResult): boolean {
  return result.ok && result.hasVideoTrack && !result.hasAudioTrack;
}

/** 音声のみ（映像を含まない）か。 */
export function isAudioOnly(result: ProbeResult): boolean {
  return result.ok && result.hasAudioTrack && !result.hasVideoTrack;
}
