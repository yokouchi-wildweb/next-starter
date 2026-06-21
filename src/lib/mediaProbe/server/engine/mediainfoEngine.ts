// src/lib/mediaProbe/server/engine/mediainfoEngine.ts
//
// 既定の probe エンジン。mediainfo.js（WASM）でコンテナを解析する。
// native バイナリの同梱を伴わないため、サーバーレス（Vercel）でも移植性が高い。
// 幅広いコンテナ（mp4/mov/webm/mkv/mp3/wav/ogg/aac/flac 等）に対応する。

import { createRequire } from "node:module";
import path from "node:path";

import mediaInfoFactory from "mediainfo.js";
import type { MediaInfo, MediaInfoResult, Track } from "mediainfo.js";

import type { ProbeFacts } from "../../types";
import { normalizeContainer, toNumberOrNull, toStringOrNull } from "../normalize";
import type { MediaSource, ProbeEngine } from "./types";
import { ProbeEngineError } from "./types";

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

const wasmPath = resolveWasmPath();

export const mediainfoEngine: ProbeEngine = {
  name: "mediainfo",
  async probe(source: MediaSource): Promise<ProbeFacts> {
    if (source.sizeBytes == null) {
      throw new ProbeEngineError("fetch_failed", "メディアのサイズを取得できませんでした。");
    }
    const size = source.sizeBytes;

    let mediainfo: MediaInfo;
    try {
      mediainfo = await mediaInfoFactory({
        format: "object",
        ...(wasmPath ? { locateFile: () => wasmPath } : {}),
      });
    } catch (e) {
      throw new ProbeEngineError(
        "probe_failed",
        `メディア解析エンジンの初期化に失敗しました: ${errMessage(e)}`,
      );
    }

    try {
      // mediainfo の readChunk は (chunkSize, offset) 順。MediaSource は (offset, length) 順。
      const result = await mediainfo.analyzeData(
        size,
        (chunkSize: number, offset: number) => source.readChunk(offset, chunkSize),
      );
      return toFacts(result);
    } catch (e) {
      if (e instanceof ProbeEngineError) throw e;
      throw new ProbeEngineError("probe_failed", `メディアの解析に失敗しました: ${errMessage(e)}`);
    } finally {
      try {
        mediainfo.close();
      } catch {
        // noop
      }
    }
  },
};
