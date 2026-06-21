// src/lib/mediaProbe/server/mediaSource.ts
//
// MediaRef（storagePath / downloadUrl）から MediaSource を構築する。
// フルダウンロードせず、署名付き URL に対する Range リクエストでバイトを取得する。

import {
  getFileMetadata,
  getPathFromStorageUrl,
  getReadSignedUrl,
} from "@/lib/firebase/server/storage";

import type { MediaRef } from "../types";
import type { MediaSource } from "./engine/types";
import { ProbeEngineError } from "./engine/types";

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

type ResolvedSource = { url: string; sizeBytes: number | null; contentType: string | null };

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
  // ボディは破棄（接続を解放）
  try {
    await res.arrayBuffer();
  } catch {
    // noop
  }
  return { sizeBytes, contentType: res.headers.get("content-type") };
}

/** MediaRef を 署名 URL + メタデータ へ解決する。 */
async function resolve(ref: MediaRef, signedUrlTtlSec: number): Promise<ResolvedSource> {
  let url: string;
  let sizeBytes: number | null = null;
  let contentType: string | null = null;

  try {
    if ("storagePath" in ref) {
      url = await getReadSignedUrl(ref.storagePath, signedUrlTtlSec);
      const meta = await getFileMetadata(ref.storagePath).catch(() => null);
      sizeBytes = meta?.sizeBytes ?? null;
      contentType = meta?.contentType ?? null;
    } else {
      const path = getPathFromStorageUrl(ref.downloadUrl);
      if (path) {
        url = await getReadSignedUrl(path, signedUrlTtlSec);
        const meta = await getFileMetadata(path).catch(() => null);
        sizeBytes = meta?.sizeBytes ?? null;
        contentType = meta?.contentType ?? null;
      } else {
        // Storage 由来でない URL はそのまま Range 取得する
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

/** MediaRef から MediaSource を構築する。 */
export async function createMediaSource(
  ref: MediaRef,
  signedUrlTtlSec: number,
): Promise<MediaSource> {
  const { url, sizeBytes, contentType } = await resolve(ref, signedUrlTtlSec);

  return {
    url,
    sizeBytes,
    contentType,
    async readChunk(offset: number, length: number): Promise<Uint8Array> {
      const end = offset + length - 1;
      let res: Response;
      try {
        res = await fetch(url, { headers: { Range: `bytes=${offset}-${end}` } });
      } catch (e) {
        throw new ProbeEngineError(
          "fetch_failed",
          `メディアの取得に失敗しました: ${errMessage(e)}`,
        );
      }
      if (res.status !== 206 && res.status !== 200) {
        throw new ProbeEngineError(
          "fetch_failed",
          `メディアの取得に失敗しました (HTTP ${res.status})`,
        );
      }
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}
