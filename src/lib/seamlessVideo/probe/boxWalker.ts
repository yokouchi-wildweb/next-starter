// src/lib/seamlessVideo/probe/boxWalker.ts
//
// 最小限の ISO BMFF(MP4)ボックス解析。外部依存なし。
// fmp4 の検証に必要な範囲のみを対象とする(汎用 MP4 デマルチプレクサではない):
//   - fragmented 判定(moof / mvex)
//   - 映像コーデック・解像度(avc1 / avcC)
//   - 音声トラックの有無
//   - 先頭サンプルが同期サンプル(キーフレーム)か(moof/traf/tfhd/trun のサンプルフラグ)
// 解析できない場合は例外を投げず、上位(validateFragments)で「不明」として扱えるよう設計する。

import type { FragmentInfo } from "../types";

/** ISO BMFF の 1 ボックス。offset はバッファ先頭からのバイト位置。 */
export type Mp4Box = {
  type: string;
  /** ボックス先頭(size フィールド)の位置 */
  start: number;
  /** ヘッダ長(8 もしくは 64bit largesize 時は 16) */
  headerSize: number;
  /** ボックス全体のバイト数 */
  size: number;
  /** ボックス終端(start + size) */
  end: number;
};

function readType(view: DataView, offset: number): string {
  return (
    String.fromCharCode(view.getUint8(offset)) +
    String.fromCharCode(view.getUint8(offset + 1)) +
    String.fromCharCode(view.getUint8(offset + 2)) +
    String.fromCharCode(view.getUint8(offset + 3))
  );
}

/** [start, end) の範囲を走査し、直下のボックス一覧を返す。 */
export function readBoxes(view: DataView, start: number, end: number): Mp4Box[] {
  const boxes: Mp4Box[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = view.getUint32(offset);
    const type = readType(view, offset + 4);
    let headerSize = 8;
    if (size === 1) {
      // 64bit largesize(上位 32bit はほぼ 0 想定。Number で安全に扱える範囲のみ対応)
      const high = view.getUint32(offset + 8);
      const low = view.getUint32(offset + 12);
      size = high * 2 ** 32 + low;
      headerSize = 16;
    } else if (size === 0) {
      // 末尾までを 1 ボックスとして扱う
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) break;
    boxes.push({ type, start: offset, headerSize, size, end: offset + size });
    offset += size;
  }
  return boxes;
}

/** [start, end) 直下から type に一致する最初のボックスを返す。 */
export function findBox(view: DataView, start: number, end: number, type: string): Mp4Box | null {
  for (const box of readBoxes(view, start, end)) {
    if (box.type === type) return box;
  }
  return null;
}

/** パス(例: ["moov","trak","mdia"])を辿って最初に一致したボックスを返す。 */
function findPath(view: DataView, start: number, end: number, path: string[]): Mp4Box | null {
  let s = start;
  let e = end;
  let found: Mp4Box | null = null;
  for (const type of path) {
    found = findBox(view, s, e, type);
    if (!found) return null;
    s = found.start + found.headerSize;
    e = found.end;
  }
  return found;
}

function toHex2(n: number): string {
  return n.toString(16).padStart(2, "0").toUpperCase();
}

/** trak が映像/音声どちらのハンドラかを返す。 */
function readHandlerType(view: DataView, trak: Mp4Box): string | null {
  const hdlr = findPath(view, trak.start + trak.headerSize, trak.end, ["mdia", "hdlr"]);
  if (!hdlr) return null;
  // hdlr: header(8) + version/flags(4) + pre_defined(4) + handler_type(4)
  const p = hdlr.start + hdlr.headerSize + 8;
  if (p + 4 > hdlr.end) return null;
  return readType(view, p);
}

/** 映像 trak の stsd 先頭サンプルエントリから codec / width / height を抽出。 */
function readVideoSampleEntry(
  view: DataView,
  trak: Mp4Box,
): { codec: string | null; width: number | null; height: number | null } {
  const stsd = findPath(view, trak.start + trak.headerSize, trak.end, ["mdia", "minf", "stbl", "stsd"]);
  if (!stsd) return { codec: null, width: null, height: null };
  // stsd: header(8) + version/flags(4) + entry_count(4) → 先頭サンプルエントリ
  const entryStart = stsd.start + stsd.headerSize + 8;
  const entries = readBoxes(view, entryStart, stsd.end);
  const entry = entries[0];
  if (!entry) return { codec: null, width: null, height: null };

  // VisualSampleEntry の固定領域からの width/height(ボックスヘッダ後 +24, +26)
  const base = entry.start + entry.headerSize;
  const width = base + 26 <= entry.end ? view.getUint16(base + 24) : null;
  const height = base + 28 <= entry.end ? view.getUint16(base + 26) : null;

  // avc1 / avc3 のみ codec を導出。子 avcC から profile/compat/level を読む
  let codec: string | null = null;
  if (entry.type === "avc1" || entry.type === "avc3") {
    const childStart = entry.start + entry.headerSize + 78; // VisualSampleEntry 固定長 78
    const avcC = findBox(view, childStart, entry.end, "avcC");
    if (avcC) {
      const c = avcC.start + avcC.headerSize;
      // AVCDecoderConfigurationRecord: version(1) profile(1) compat(1) level(1)
      if (c + 4 <= avcC.end) {
        const profile = view.getUint8(c + 1);
        const compat = view.getUint8(c + 2);
        const level = view.getUint8(c + 3);
        codec = `${entry.type}.${toHex2(profile)}${toHex2(compat)}${toHex2(level)}`;
      }
    }
  }
  return { codec, width, height };
}

// trun / tfhd / sample_flags のフラグビット
const TFHD_DEFAULT_SAMPLE_FLAGS_PRESENT = 0x000020;
const TFHD_BASE_DATA_OFFSET_PRESENT = 0x000001;
const TFHD_SAMPLE_DESC_INDEX_PRESENT = 0x000002;
const TFHD_DEFAULT_SAMPLE_DURATION_PRESENT = 0x000008;
const TFHD_DEFAULT_SAMPLE_SIZE_PRESENT = 0x000010;

const TRUN_DATA_OFFSET_PRESENT = 0x000001;
const TRUN_FIRST_SAMPLE_FLAGS_PRESENT = 0x000004;
const TRUN_SAMPLE_FLAGS_PRESENT = 0x000400;

/** sample_flags の "sample_is_non_sync_sample" ビット(立っていれば非キーフレーム)。 */
function isSyncSampleFlags(flags: number): boolean {
  return (flags & 0x00010000) === 0;
}

/**
 * 先頭 moof の最初の traf を見て、先頭サンプルが同期サンプル(キーフレーム)かを判定。
 * 判定根拠が得られない場合は null(不明)。
 */
function readStartsWithKeyframe(view: DataView, end: number): boolean | null {
  const moof = findBox(view, 0, end, "moof");
  if (!moof) return null;
  const traf = findBox(view, moof.start + moof.headerSize, moof.end, "traf");
  if (!traf) return null;

  // tfhd: default_sample_flags(あれば)を回収
  let defaultSampleFlags: number | null = null;
  const tfhd = findBox(view, traf.start + traf.headerSize, traf.end, "tfhd");
  if (tfhd) {
    let p = tfhd.start + tfhd.headerSize;
    const flags = view.getUint32(p) & 0x00ffffff; // version + 24bit flags
    p += 4 + 4; // version/flags + track_ID
    if (flags & TFHD_BASE_DATA_OFFSET_PRESENT) p += 8;
    if (flags & TFHD_SAMPLE_DESC_INDEX_PRESENT) p += 4;
    if (flags & TFHD_DEFAULT_SAMPLE_DURATION_PRESENT) p += 4;
    if (flags & TFHD_DEFAULT_SAMPLE_SIZE_PRESENT) p += 4;
    if (flags & TFHD_DEFAULT_SAMPLE_FLAGS_PRESENT) {
      if (p + 4 <= tfhd.end) defaultSampleFlags = view.getUint32(p);
    }
  }

  // trun: first_sample_flags か 先頭サンプルの sample_flags を回収
  const trun = findBox(view, traf.start + traf.headerSize, traf.end, "trun");
  if (!trun) {
    return defaultSampleFlags !== null ? isSyncSampleFlags(defaultSampleFlags) : null;
  }
  let p = trun.start + trun.headerSize;
  const flags = view.getUint32(p) & 0x00ffffff;
  p += 4; // version/flags
  p += 4; // sample_count
  if (flags & TRUN_DATA_OFFSET_PRESENT) p += 4;
  if (flags & TRUN_FIRST_SAMPLE_FLAGS_PRESENT) {
    if (p + 4 <= trun.end) return isSyncSampleFlags(view.getUint32(p));
    return null;
  }
  if (flags & TRUN_SAMPLE_FLAGS_PRESENT) {
    // 先頭サンプルエントリ内の sample_flags 位置を算出
    let entryOffset = 0;
    if (flags & 0x000100) entryOffset += 4; // sample_duration
    if (flags & 0x000200) entryOffset += 4; // sample_size
    const flagsPos = p + entryOffset;
    if (flagsPos + 4 <= trun.end) return isSyncSampleFlags(view.getUint32(flagsPos));
    return null;
  }
  return defaultSampleFlags !== null ? isSyncSampleFlags(defaultSampleFlags) : null;
}

/** 映像トラックの mdhd timescale を返す。 */
function readVideoTimescale(view: DataView, moov: Mp4Box): number | null {
  for (const trak of readBoxes(view, moov.start + moov.headerSize, moov.end).filter((b) => b.type === "trak")) {
    if (readHandlerType(view, trak) !== "vide") continue;
    const mdhd = findPath(view, trak.start + trak.headerSize, trak.end, ["mdia", "mdhd"]);
    if (!mdhd) return null;
    const p = mdhd.start + mdhd.headerSize;
    const version = view.getUint8(p);
    // version0: creation(4) modification(4) timescale(4) / version1: creation(8) modification(8) timescale(4)
    const tsOffset = version === 1 ? p + 4 + 16 : p + 4 + 8;
    if (tsOffset + 4 <= mdhd.end) return view.getUint32(tsOffset);
    return null;
  }
  return null;
}

/** mvex/trex の default_sample_duration を返す(trun に尺が無い場合のフォールバック)。 */
function readTrexDefaultDuration(view: DataView, moov: Mp4Box): number | null {
  const mvex = findBox(view, moov.start + moov.headerSize, moov.end, "mvex");
  if (!mvex) return null;
  const trex = findBox(view, mvex.start + mvex.headerSize, mvex.end, "trex");
  if (!trex) return null;
  // header + version/flags(4) + track_ID(4) + default_sample_description_index(4) → default_sample_duration
  const p = trex.start + trex.headerSize + 4 + 4 + 4;
  if (p + 4 <= trex.end) return view.getUint32(p);
  return null;
}

/**
 * 全 moof/traf/trun のサンプル尺を合計する(timescale 単位)。
 * 映像のみ fmp4 を前提(全 traf を対象に合算する)。算出不能なら null。
 */
function sumSampleDurations(view: DataView, end: number, trexDefault: number | null): number | null {
  let total = 0;
  let counted = false;

  for (const moof of readBoxes(view, 0, end).filter((b) => b.type === "moof")) {
    for (const traf of readBoxes(view, moof.start + moof.headerSize, moof.end).filter((b) => b.type === "traf")) {
      // tfhd の default_sample_duration を回収
      let tfDefault: number | null = null;
      const tfhd = findBox(view, traf.start + traf.headerSize, traf.end, "tfhd");
      if (tfhd) {
        let p = tfhd.start + tfhd.headerSize;
        const flags = view.getUint32(p) & 0x00ffffff;
        p += 4 + 4; // version/flags + track_ID
        if (flags & TFHD_BASE_DATA_OFFSET_PRESENT) p += 8;
        if (flags & TFHD_SAMPLE_DESC_INDEX_PRESENT) p += 4;
        if (flags & TFHD_DEFAULT_SAMPLE_DURATION_PRESENT) {
          if (p + 4 <= tfhd.end) tfDefault = view.getUint32(p);
        }
      }

      const trun = findBox(view, traf.start + traf.headerSize, traf.end, "trun");
      if (!trun) continue;
      let p = trun.start + trun.headerSize;
      const flags = view.getUint32(p) & 0x00ffffff;
      p += 4; // version/flags
      const sampleCount = view.getUint32(p);
      p += 4;
      if (flags & TRUN_DATA_OFFSET_PRESENT) p += 4;
      if (flags & TRUN_FIRST_SAMPLE_FLAGS_PRESENT) p += 4;

      const durPresent = !!(flags & 0x000100);
      if (durPresent) {
        const recSize =
          4 + (flags & 0x000200 ? 4 : 0) + (flags & 0x000400 ? 4 : 0) + (flags & 0x000800 ? 4 : 0);
        for (let i = 0; i < sampleCount; i++) {
          const recStart = p + i * recSize;
          if (recStart + 4 <= trun.end) {
            total += view.getUint32(recStart);
            counted = true;
          }
        }
      } else {
        const d = tfDefault ?? trexDefault;
        if (d != null) {
          total += d * sampleCount;
          counted = true;
        }
      }
    }
  }

  return counted ? total : null;
}

/**
 * fmp4 バイト列を解析して FragmentInfo を返す。
 * 解析途中で破綻した場合も例外は投げず、可能な範囲の情報を返す。
 */
export function parseFragment(buffer: ArrayBuffer): FragmentInfo {
  const info: FragmentInfo = {
    isFragmented: false,
    codec: null,
    mimeType: null,
    width: null,
    height: null,
    startsWithKeyframe: null,
    hasAudio: false,
    durationSec: null,
  };

  try {
    const view = new DataView(buffer);
    const end = buffer.byteLength;

    const moov = findBox(view, 0, end, "moov");
    const moof = findBox(view, 0, end, "moof");
    const mvex = moov ? findBox(view, moov.start + moov.headerSize, moov.end, "mvex") : null;
    info.isFragmented = !!moof || !!mvex;

    if (moov) {
      for (const trak of readBoxes(view, moov.start + moov.headerSize, moov.end).filter((b) => b.type === "trak")) {
        const handler = readHandlerType(view, trak);
        if (handler === "soun") info.hasAudio = true;
        if (handler === "vide" && !info.codec) {
          const { codec, width, height } = readVideoSampleEntry(view, trak);
          info.codec = codec;
          info.width = width;
          info.height = height;
        }
      }
    }

    if (info.codec) info.mimeType = `video/mp4; codecs="${info.codec}"`;
    info.startsWithKeyframe = readStartsWithKeyframe(view, end);

    if (moov) {
      const timescale = readVideoTimescale(view, moov);
      const trexDefault = readTrexDefaultDuration(view, moov);
      const totalDur = sumSampleDurations(view, end, trexDefault);
      if (timescale && timescale > 0 && totalDur != null) {
        info.durationSec = totalDur / timescale;
      }
    }
  } catch {
    // 解析失敗時は取得済みの部分情報のみを返す
  }

  return info;
}

/** parseFragment の例外安全ラッパー(常に解析を試み、失敗時は null)。 */
export function parseFragmentSafe(buffer: ArrayBuffer): FragmentInfo | null {
  try {
    return parseFragment(buffer);
  } catch {
    return null;
  }
}
