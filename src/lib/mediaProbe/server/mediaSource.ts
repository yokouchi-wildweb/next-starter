// src/lib/mediaProbe/server/mediaSource.ts
//
// MediaRef（authorizedUrl / storagePath / downloadUrl）から MediaSource を構築する。
// フルダウンロードせず、署名付き URL に対する Range リクエストでバイトを取得する。
// Range を無視して 200（全体）を返すサーバーには、要求した長さを超えた時点で読むのをやめて失敗にする
// （大きなファイルの全体をメモリに読み込まない）。
// 旧バケットの位置だけをここで署名する（lib/storage/server の legacy 判定。pub / priv の管理下の物は扱わない）。
//
// 取得戦略（head+tail プリフェッチ）:
//   コンテナの「目次」（ftyp/moov 等）は先頭・末尾に集中する。生成時に先頭/末尾の窓を
//   並列 Range 2 本でメモリへ取得し、readChunk は窓内ならメモリから即返す。窓外を要求
//   された場合のみ追加 Range フェッチへフォールバックする。これにより mediainfo の
//   seek 駆動ループが発生させる多数の直列往復を、定数回の並列往復へ収束させる。
//   プリフェッチは best-effort（失敗時はバッファ無しで従来のチャンク取得へ劣化）。

import { isStorageRef } from "@/lib/storage";
import { getStoragePort, legacyLocationOfPath, parseLegacyStorageUrl } from "@/lib/storage/server";
import type { ObjectLocation } from "@/lib/storage/server";

import type { MediaRef } from "../types";
import type { MediaSource } from "./engine/types";
import { ProbeEngineError } from "./engine/types";

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** head+tail プリフェッチの窓サイズ（バイト）。0 でその窓を無効化。 */
export type PrefetchConfig = { headBytes: number; tailBytes: number };

type ResolvedSource = { url: string; sizeBytes: number | null; contentType: string | null };

/** メモリ上に保持したバイト区間。[start, start+bytes.length) を表す。 */
type Segment = { start: number; bytes: Uint8Array };

/** Range レスポンスの生バイトと、サーバーが Range を無視して全件返したか（200）。 */
type RangeBytes = { bytes: Uint8Array; isFull: boolean };

/**
 * 応答の本体を最大 maxBytes まで読む。超えたら読み取りを中止して null（全体を読み込まない）。
 */
async function readBodyAtMost(res: Response, maxBytes: number): Promise<Uint8Array | null> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await res.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!res.body) return new Uint8Array(await res.arrayBuffer());

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, position);
    position += chunk.byteLength;
  }
  return bytes;
}

function rangeIgnored(): ProbeEngineError {
  return new ProbeEngineError(
    "fetch_failed",
    "メディアの取得に失敗しました（Range に対して全体が返されたため、読み込みを中止しました）",
  );
}

/**
 * Range で [offset, offset+length) を取得する。
 * 206 のときは要求どおりの区間が返る。Range 非対応プロキシ等で 200（全件）が返った場合は
 * isFull=true（呼び出し側で先頭からのスライスが必要）。ただし全体が length を超えるなら
 * 読み込みを中止して throw する（大きな全体応答をメモリに読まない）。取得不能も throw する。
 */
export async function fetchRangeRaw(url: string, offset: number, length: number): Promise<RangeBytes> {
  const end = offset + length - 1;
  let res: Response;
  try {
    res = await fetch(url, { headers: { Range: `bytes=${offset}-${end}` } });
  } catch (e) {
    throw new ProbeEngineError("fetch_failed", `メディアの取得に失敗しました: ${errMessage(e)}`);
  }
  if (res.status !== 206 && res.status !== 200) {
    throw new ProbeEngineError(
      "fetch_failed",
      `メディアの取得に失敗しました (HTTP ${res.status})`,
    );
  }
  if (res.status === 200) {
    // 全体が要求した長さに収まる小さなファイルだけ受け入れる（それより大きい全体は読まない）
    const bytes = await readBodyAtMost(res, length);
    if (!bytes) throw rangeIgnored();
    return { bytes, isFull: true };
  }
  const bytes = await readBodyAtMost(res, length);
  if (!bytes) throw rangeIgnored();
  return { bytes, isFull: false };
}

/** Range bytes=0-0 でサイズ・Content-Type を確認する（メタデータ取得不能時のフォールバック）。 */
async function fetchSizeAndType(
  url: string,
): Promise<{ sizeBytes: number | null; contentType: string | null }> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Range: "bytes=0-0" } });
  } catch (e) {
    throw new ProbeEngineError("fetch_failed", `メディアの取得に失敗しました: ${errMessage(e)}`);
  }
  if (res.status !== 206 && res.status !== 200) {
    throw new ProbeEngineError(
      "fetch_failed",
      `メディアの取得に失敗しました (HTTP ${res.status})`,
    );
  }
  let sizeBytes: number | null = null;
  const contentRange = res.headers.get("content-range"); // 例: "bytes 0-0/123456"
  if (contentRange) {
    const total = Number(contentRange.split("/")[1]);
    if (Number.isFinite(total)) sizeBytes = total;
  }
  if (sizeBytes == null && res.status === 200) {
    const contentLength = res.headers.get("content-length");
    if (contentLength) {
      const n = Number(contentLength);
      if (Number.isFinite(n)) sizeBytes = n;
    }
  }
  // ボディは読まずに破棄（200 で全体が返っても読み込まない。接続を解放）
  await res.body?.cancel().catch(() => undefined);
  return { sizeBytes, contentType: res.headers.get("content-type") };
}

/** 旧バケットの位置を、その世代の短期署名 URL + メタデータへ解決する。 */
async function signLegacy(location: ObjectLocation, ttlSec: number): Promise<ResolvedSource> {
  const port = getStoragePort();
  const head = await port.head(location);
  if (!head) throw new ProbeEngineError("fetch_failed", "メディアが見つかりません");
  const url = await port.signRead(location, { generation: head.generation, ttlSec });
  return { url, sizeBytes: head.size, contentType: head.contentType };
}

/** MediaRef を 署名 URL + メタデータ へ解決する。 */
async function resolve(ref: MediaRef, signedUrlTtlSec: number): Promise<ResolvedSource> {
  let url: string;
  let sizeBytes: number | null = null;
  let contentType: string | null = null;

  try {
    if ("authorizedUrl" in ref) {
      // 呼び出し元が認可して作った短期 URL
      url = ref.authorizedUrl;
      sizeBytes = ref.sizeBytes ?? null;
      contentType = ref.contentType ?? null;
    } else if ("storagePath" in ref) {
      const location = legacyLocationOfPath(ref.storagePath);
      if (!location) {
        throw new ProbeEngineError("fetch_failed", "旧バケット内のパスだけを解析できます");
      }
      ({ url, sizeBytes, contentType } = await signLegacy(location, signedUrlTtlSec));
    } else if (isStorageRef(ref.downloadUrl)) {
      throw new ProbeEngineError(
        "fetch_failed",
        "storage の ref は呼び出し元で認可し、authorizedUrl で渡してください",
      );
    } else {
      const location = parseLegacyStorageUrl(ref.downloadUrl);
      if (location) {
        ({ url, sizeBytes, contentType } = await signLegacy(location, signedUrlTtlSec));
      } else {
        // 旧バケット由来でない URL はそのまま Range 取得する
        url = ref.downloadUrl;
      }
    }
  } catch (e) {
    if (e instanceof ProbeEngineError) throw e;
    throw new ProbeEngineError(
      "fetch_failed",
      `メディア参照の解決に失敗しました: ${errMessage(e)}`,
    );
  }

  if (sizeBytes == null) {
    const fallback = await fetchSizeAndType(url);
    sizeBytes = fallback.sizeBytes;
    contentType = contentType ?? fallback.contentType;
  }

  return { url, sizeBytes, contentType };
}

/**
 * 先頭/末尾の窓を並列 Range で取得し、メモリ区間（Segment）として返す。
 * 各 Range は best-effort。失敗した窓は単に除外され、readChunk が必要時に再取得する。
 */
async function prefetchSegments(
  url: string,
  size: number,
  cfg: PrefetchConfig,
): Promise<Segment[]> {
  const headLen = Math.min(Math.max(cfg.headBytes, 0), size);
  const tailStart = Math.max(headLen, size - Math.max(cfg.tailBytes, 0));
  const tailLen = size - tailStart;

  const tasks: Promise<Segment | null>[] = [];

  if (headLen > 0) {
    tasks.push(
      // 206 は要求どおり先頭から headLen バイト。200（全件）も先頭からなので、いずれも start=0。
      fetchRangeRaw(url, 0, headLen).then(
        ({ bytes }) => ({ start: 0, bytes }),
        () => null,
      ),
    );
  }
  if (tailLen > 0) {
    tasks.push(
      fetchRangeRaw(url, tailStart, tailLen).then(
        ({ bytes, isFull }) =>
          // 200 のときは bytes が先頭からの全件なので start=0。206 は要求した tailStart から。
          isFull ? { start: 0, bytes } : { start: tailStart, bytes },
        () => null,
      ),
    );
  }

  const segs = await Promise.all(tasks);
  return segs.filter((s): s is Segment => s !== null);
}

/** 要求区間 [offset, offset+length) を完全に含む Segment があればそこからスライスして返す。 */
function readFromSegments(segments: Segment[], offset: number, length: number): Uint8Array | null {
  for (const seg of segments) {
    const segEnd = seg.start + seg.bytes.length;
    if (offset >= seg.start && offset + length <= segEnd) {
      const rel = offset - seg.start;
      return seg.bytes.subarray(rel, rel + length);
    }
  }
  return null;
}

/** MediaRef から MediaSource を構築する（head+tail プリフェッチ付き）。 */
export async function createMediaSource(
  ref: MediaRef,
  signedUrlTtlSec: number,
  prefetch: PrefetchConfig,
): Promise<MediaSource> {
  const { url, sizeBytes, contentType } = await resolve(ref, signedUrlTtlSec);

  // サイズが判明していれば先頭/末尾をプリフェッチ。失敗・サイズ不明時は空（=従来のチャンク取得）。
  const segments =
    sizeBytes != null && sizeBytes > 0
      ? await prefetchSegments(url, sizeBytes, prefetch).catch(() => [])
      : [];

  return {
    url,
    sizeBytes,
    contentType,
    async readChunk(offset: number, length: number): Promise<Uint8Array> {
      const hit = readFromSegments(segments, offset, length);
      if (hit) return hit;
      // 窓外: 追加 Range フェッチ。200（全件）が返った場合は要求オフセットへスライス。
      const { bytes, isFull } = await fetchRangeRaw(url, offset, length);
      return isFull ? bytes.subarray(offset, offset + length) : bytes;
    },
  };
}
