// src/lib/mediaProbe/server/engine/mediainfoEngine.ts
//
// 既定の probe エンジン。mediainfo.js（WASM）でコンテナを解析する。
// native バイナリの同梱を伴わないため、サーバーレス（Vercel）でも移植性が高い。
// 幅広いコンテナ（mp4/mov/webm/mkv/mp3/wav/ogg/aac/flac 等）に対応する。
//
// パフォーマンス:
//   WASM（約 2.5MB）の compile+instantiate はコールド時に秒単位を要するため、MediaInfo
//   インスタンスを「上限付きプール」で再利用する（毎回の再初期化を回避）。MediaInfo は
//   analyzeData を同時並行で実行できない（内部で isAnalyzing 排他）ため、プールが
//   同時実行数を MAX_INSTANCES に制限しつつ並行性も確保する。メモリは MAX_INSTANCES×WASM に有界。

import { createRequire } from "node:module";
import path from "node:path";

import mediaInfoFactory from "mediainfo.js";
import type { MediaInfo, MediaInfoResult, Track } from "mediainfo.js";

import type { ProbeFacts } from "../../types";
import { normalizeContainer, toNumberOrNull, toStringOrNull } from "../normalize";
import type { MediaSource, ProbeEngine } from "./types";
import { ProbeEngineError } from "./types";

/** analyzeData のチャンクサイズ（バイト）。プリフェッチ済みバッファからの WASM 投入回数を抑える。 */
const DEFAULT_CHUNK_SIZE = 1 << 20; // 1MB（mediainfo.js 既定の 256KB より大きく）

/** 同時に保持・実行する MediaInfo インスタンスの上限（=最大同時解析数）。 */
const MAX_INSTANCES = 4;

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * バンドル環境でも WASM を解決できるよう、node_modules 上の絶対パスを返す。
 * 解決できなければ null（mediainfo.js の既定解決に委ねる）。
 */
function resolveWasmPath(): string | null {
  try {
    const req = createRequire(import.meta.url);
    // ".wasm" の文字列リテラルを Turbopack に静的解析させない（WASM ローダーの自動生成を防ぐ）ため、
    // package.json からパッケージのディレクトリを辿り、.wasm の絶対パスは実行時に組み立てる。
    const pkgDir = path.dirname(req.resolve("mediainfo.js/package.json"));
    return path.join(pkgDir, "dist", "MediaInfoModule.wasm");
  } catch {
    return null;
  }
}

const wasmPath = resolveWasmPath();

// ─────────────────────────────────────────────────────────────────────────────
// インスタンスプール（permit セマフォ + アイドルインスタンスのスタック）
//   - permit: 同時実行数を MAX_INSTANCES に制限。在庫が尽きると FIFO で待機。
//   - idle:   再利用可能な MediaInfo。analyzeData は冒頭で reset() するため使い回し可。
//   - 異常終了したインスタンスはプールへ戻さず close する（健全なプールを維持）。
// ─────────────────────────────────────────────────────────────────────────────
let permits = MAX_INSTANCES;
const idle: MediaInfo[] = [];
const waiters: Array<() => void> = [];

async function acquirePermit(): Promise<void> {
  if (permits > 0) {
    permits -= 1;
    return;
  }
  // 上限到達: 解放を待つ（releasePermit が permit を直接引き渡す）。
  await new Promise<void>((resolve) => waiters.push(resolve));
}

function releasePermit(): void {
  const next = waiters.shift();
  if (next) {
    next(); // permit はデクリメントしたまま待機者へ受け渡し
  } else {
    permits += 1;
  }
}

async function createInstance(): Promise<MediaInfo> {
  try {
    return await mediaInfoFactory({
      format: "object",
      chunkSize: DEFAULT_CHUNK_SIZE,
      ...(wasmPath ? { locateFile: () => wasmPath } : {}),
    });
  } catch (e) {
    throw new ProbeEngineError(
      "probe_failed",
      `メディア解析エンジンの初期化に失敗しました: ${errMessage(e)}`,
    );
  }
}

/**
 * プールから MediaInfo を 1 つ確保して fn を実行する。
 * fn が throw した場合はインスタンスを破棄（close）し、正常終了時のみプールへ戻す。
 */
async function withInstance<T>(fn: (mi: MediaInfo) => Promise<T>): Promise<T> {
  await acquirePermit();
  let mi: MediaInfo | null = idle.pop() ?? null;
  let healthy = true;
  try {
    if (!mi) mi = await createInstance();
    return await fn(mi);
  } catch (e) {
    healthy = false;
    throw e;
  } finally {
    if (mi && healthy) {
      idle.push(mi);
    } else if (mi) {
      try {
        mi.close();
      } catch {
        // noop
      }
    }
    releasePermit();
  }
}

function findTrack(tracks: readonly Track[], type: Track["@type"]): Track | undefined {
  return tracks.find((t) => t["@type"] === type);
}

/** mediainfo の解析結果を ProbeFacts へ正規化する。 */
function toFacts(result: MediaInfoResult): ProbeFacts {
  const tracks = result.media?.track ?? [];
  const general = findTrack(tracks, "General");
  const video = findTrack(tracks, "Video");
  const audio = findTrack(tracks, "Audio");

  const container = normalizeContainer(
    general && "Format" in general ? general.Format : null,
    general && "FileExtension" in general ? general.FileExtension : null,
  );

  const durationSec =
    toNumberOrNull(general && "Duration" in general ? general.Duration : null) ??
    toNumberOrNull(video && "Duration" in video ? video.Duration : null) ??
    toNumberOrNull(audio && "Duration" in audio ? audio.Duration : null);

  const facts: ProbeFacts = {
    container,
    durationSec,
    hasVideoTrack: Boolean(video),
    hasAudioTrack: Boolean(audio),
    video: video
      ? {
          codec: toStringOrNull("Format" in video ? video.Format : null),
          width: toNumberOrNull("Width" in video ? video.Width : null),
          height: toNumberOrNull("Height" in video ? video.Height : null),
          fps: toNumberOrNull("FrameRate" in video ? video.FrameRate : null),
        }
      : null,
    audio: audio
      ? {
          codec: toStringOrNull("Format" in audio ? audio.Format : null),
          channels: toNumberOrNull("Channels" in audio ? audio.Channels : null),
          sampleRate: toNumberOrNull("SamplingRate" in audio ? audio.SamplingRate : null),
        }
      : null,
  };

  if (!facts.hasVideoTrack && !facts.hasAudioTrack && facts.container === null) {
    throw new ProbeEngineError(
      "unsupported_container",
      "対応していない、または解析不能なメディアです。",
    );
  }
  return facts;
}

export const mediainfoEngine: ProbeEngine = {
  name: "mediainfo",
  async probe(source: MediaSource): Promise<ProbeFacts> {
    if (source.sizeBytes == null) {
      throw new ProbeEngineError("fetch_failed", "メディアのサイズを取得できませんでした。");
    }
    const size = source.sizeBytes;

    // analyzeData のみプールインスタンス上で実行（WASM 状態に依存する処理）。
    // toFacts（純粋な正規化。unsupported_container を throw しうる）はプール外で行い、
    // 「メディアが非対応」を理由に健全なインスタンスを破棄しないようにする。
    const result = await withInstance(async (mediainfo) => {
      try {
        // mediainfo の readChunk は (chunkSize, offset) 順。MediaSource は (offset, length) 順。
        return await mediainfo.analyzeData(
          size,
          (chunkSize: number, offset: number) => source.readChunk(offset, chunkSize),
        );
      } catch (e) {
        if (e instanceof ProbeEngineError) throw e;
        throw new ProbeEngineError("probe_failed", `メディアの解析に失敗しました: ${errMessage(e)}`);
      }
    });

    return toFacts(result);
  },
};
