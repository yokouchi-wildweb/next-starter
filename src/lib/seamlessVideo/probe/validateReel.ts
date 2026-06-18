// src/lib/seamlessVideo/probe/validateReel.ts
//
// 音声付き連結(SeamlessReel)用のフォーマット検証。
// 各フラグメントの「映像(fmp4)」と「音声(デコード可否・尺)」を検査し、映像/音声尺の整合まで確認する。
// 映像のみの検証は validateFragments を流用し、ここでは音声と尺整合を上乗せする。

import type { FragmentInfo, SeamlessFragmentSource } from "../types";
import { toArrayBuffer } from "../core/fragmentBytes";
import { isTypeSupported } from "../core/codecSupport";
import { parseFragment } from "./boxWalker";

/** 映像/音声尺の許容差(秒)。これを超えると尺不一致の警告。 */
const DURATION_TOLERANCE_SEC = 0.1;

export type ReelFragmentInput = {
  name: string;
  video: SeamlessFragmentSource;
  audio?: SeamlessFragmentSource;
};

export type ReelFragmentValidation = {
  name: string;
  videoInfo: FragmentInfo | null;
  videoDurationSec: number | null;
  audioProvided: boolean;
  audioDecoded: boolean;
  audioDurationSec: number | null;
  issues: string[];
  warnings: string[];
};

export type ReelValidationReport = {
  fragments: ReelFragmentValidation[];
  /** 映像の codec / 解像度がセット全体で一致するか */
  compatible: boolean;
  /** 連結に使う共通映像 MIME */
  mimeType: string | null;
  /** この環境で映像 MIME が再生可能か */
  supported: boolean;
  /** 全フラグメントに音声があり連結が有効になるか */
  hasAudioAll: boolean;
  errors: string[];
  warnings: string[];
  ok: boolean;
};

let sharedDecodeCtx: AudioContext | null = null;

function getDecodeContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedDecodeCtx) sharedDecodeCtx = new Ctor();
  return sharedDecodeCtx;
}

/** 音声をデコードして尺を得る。デコード不可なら null。 */
async function decodeAudioDuration(source: SeamlessFragmentSource): Promise<number | null> {
  const ctx = getDecodeContext();
  if (!ctx) return null;
  try {
    const buf = await toArrayBuffer(source);
    const decoded = await ctx.decodeAudioData(buf.slice(0));
    return decoded.duration;
  } catch {
    return null;
  }
}

/**
 * 映像+音声フラグメントのセットを検証する。
 */
export async function validateReel(inputs: ReelFragmentInput[]): Promise<ReelValidationReport> {
  const fragments: ReelFragmentValidation[] = [];

  for (const input of inputs) {
    const v: ReelFragmentValidation = {
      name: input.name,
      videoInfo: null,
      videoDurationSec: null,
      audioProvided: input.audio != null,
      audioDecoded: false,
      audioDurationSec: null,
      issues: [],
      warnings: [],
    };

    // 映像
    try {
      const buffer = await toArrayBuffer(input.video);
      const info = parseFragment(buffer);
      v.videoInfo = info;
      v.videoDurationSec = info.durationSec;
      if (!info.isFragmented) v.issues.push("映像が fragmented MP4 ではありません(moof / mvex が見つかりません)");
      if (!info.codec) v.issues.push("映像に H.264(avc1)トラックが見つかりません");
      if (info.startsWithKeyframe === false) {
        v.issues.push("映像の先頭がキーフレーム(IDR)ではありません。任意順での連結が破綻します");
      } else if (info.startsWithKeyframe === null) {
        v.warnings.push("映像先頭の同期判定ができませんでした(キーフレーム始まりか不明)");
      }
      if (info.hasAudio) {
        v.warnings.push("映像に音声トラックが含まれます。音声は別ファイルから再生するため、映像は無音版を推奨(映像側は常時ミュート)");
      }
    } catch (e) {
      v.issues.push(e instanceof Error ? e.message : "映像の解析に失敗しました");
    }

    // 音声
    if (input.audio != null) {
      const dur = await decodeAudioDuration(input.audio);
      if (dur == null) {
        v.issues.push("音声ファイルをデコードできませんでした(対応形式: wav / m4a / aac / mp3)");
      } else {
        v.audioDecoded = true;
        v.audioDurationSec = dur;
      }
    }

    // 映像/音声 尺整合
    if (v.videoDurationSec != null && v.audioDurationSec != null) {
      const diff = Math.abs(v.videoDurationSec - v.audioDurationSec);
      if (diff > DURATION_TOLERANCE_SEC) {
        v.warnings.push(
          `映像尺(${v.videoDurationSec.toFixed(2)}s)と音声尺(${v.audioDurationSec.toFixed(2)}s)が一致しません。再生は映像尺をマスターに揃えます`,
        );
      }
    }

    fragments.push(v);
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // 映像の codec / 解像度一致(= init 互換)
  const valid = fragments.filter((f) => f.videoInfo?.codec);
  const codecs = new Set(valid.map((f) => f.videoInfo!.codec));
  const resolutions = new Set(valid.map((f) => `${f.videoInfo!.width}x${f.videoInfo!.height}`));

  let compatible = false;
  let mimeType: string | null = null;
  if (valid.length === 0) {
    errors.push("有効な H.264 映像フラグメントが 1 つもありません");
  } else {
    if (codecs.size > 1) errors.push(`映像のコーデックが一致しません(${[...codecs].join(", ")})`);
    if (resolutions.size > 1) errors.push(`映像の解像度が一致しません(${[...resolutions].join(", ")})`);
    compatible = codecs.size === 1 && resolutions.size === 1 && valid.length === fragments.length;
    if (compatible) mimeType = valid[0].videoInfo!.mimeType;
  }

  const supported = mimeType ? isTypeSupported(mimeType) : false;
  if (mimeType && !supported) errors.push(`この環境では未対応の映像コーデックです: ${mimeType}`);

  // 音声の有無(全部に揃っているか)
  const audioCount = fragments.filter((f) => f.audioDecoded).length;
  const hasAudioAll = fragments.length > 0 && audioCount === fragments.length;
  if (audioCount > 0 && !hasAudioAll) {
    warnings.push("一部フラグメントに有効な音声がありません。音声連結は全フラグメントに音声がある場合のみ有効になります(このセットは映像のみ再生)");
  }

  const hasFragmentIssue = fragments.some((f) => f.issues.length > 0);
  const ok = compatible && supported && !hasFragmentIssue && errors.length === 0;

  return { fragments, compatible, mimeType, supported, hasAudioAll, errors, warnings, ok };
}
