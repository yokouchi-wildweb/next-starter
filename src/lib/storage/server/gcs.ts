// src/lib/storage/server/gcs.ts
//
// StoragePort の GCS 実装。Firebase Admin の getServerStorage() から得る @google-cloud/storage を使う。
// 構築時には Firebase に触れない（各メソッドの呼び出し時に初期化し、未設定なら FirebaseNotConfiguredError）。
//
// 暫定（スパイク S2 / S3 の結果で確定させる。src/lib/storage/README.md「暫定の点」）:
// - issuePut の署名ヘッダーの組（if-generation-match:0 と content-length-range を署名に含めて、
//   上書き不可・サイズ上限が GCS 側で強制されるか）
// - issueSession の開始条件（ifGenerationMatch:0・Origin・contentLength の宣言で、
//   上書き不可とサイズ不一致がどう扱われるか）

import "server-only";

import { getServerStorage } from "@/lib/firebase/server/app";

import { contentDispositionFor } from "../contentTypes";
import {
  ISSUED_CACHE_CONTROL,
  type HeadResult,
  type ObjectLocation,
  type StoragePort,
} from "./port";

// @google-cloud/storage は firebase-admin 経由の間接依存なので、型は戻り値から取る
type GcsBucket = ReturnType<ReturnType<typeof getServerStorage>["bucket"]>;
type File = ReturnType<GcsBucket["file"]>;

function fileOf(location: ObjectLocation, generation?: string): File {
  const bucket = getServerStorage().bucket(location.bucket);
  return generation ? bucket.file(location.path, { generation }) : bucket.file(location.path);
}

function errorCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "number" ? code : null;
}

async function headOf(file: File): Promise<HeadResult | null> {
  try {
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size);
    return {
      size: Number.isFinite(size) ? size : 0,
      contentType: metadata.contentType ?? null,
      generation: String(metadata.generation),
    };
  } catch (error) {
    if (errorCode(error) === 404) return null;
    throw error;
  }
}

async function requireHead(file: File): Promise<HeadResult> {
  const head = await headOf(file);
  if (!head) throw new Error(`書き込んだオブジェクトが見つかりません: ${file.bucket.name}/${file.name}`);
  return head;
}

export function createGcsStoragePort(): StoragePort {
  return {
    async issuePut(location, options) {
      const expiresAt = new Date(Date.now() + options.ttlSec * 1000);
      const headers: Record<string, string> = {
        "content-type": options.contentType,
        "cache-control": ISSUED_CACHE_CONTROL,
        "content-disposition": contentDispositionFor(options.contentType),
        "x-goog-if-generation-match": "0",
        "x-goog-content-length-range": `0,${options.maxBytes}`,
      };
      const { "content-type": contentType, ...extensionHeaders } = headers;
      const [url] = await fileOf(location).getSignedUrl({
        version: "v4",
        action: "write",
        expires: expiresAt,
        contentType,
        extensionHeaders,
      });
      return { url, headers, expiresAt };
    },

    async issueSession(location, options) {
      const [sessionUrl] = await fileOf(location).createResumableUpload({
        origin: options.origin,
        metadata: {
          contentType: options.contentType,
          contentLength: options.size,
          cacheControl: ISSUED_CACHE_CONTROL,
          contentDisposition: contentDispositionFor(options.contentType),
        },
        preconditionOpts: { ifGenerationMatch: 0 },
      });
      return { sessionUrl };
    },

    async head(location) {
      return headOf(fileOf(location));
    },

    async setCacheControl(location, generation, value) {
      await fileOf(location).setMetadata({ cacheControl: value }, { ifGenerationMatch: generation });
    },

    async put(location, body, options) {
      const file = fileOf(location);
      await file.save(Buffer.from(body), {
        resumable: false,
        contentType: options.contentType,
        metadata: {
          contentType: options.contentType,
          cacheControl: options.cacheControl,
          contentDisposition: contentDispositionFor(options.contentType),
        },
        preconditionOpts: { ifGenerationMatch: 0 },
      });
      return requireHead(file);
    },

    async copy(source, destination, options) {
      const sourceFile = fileOf(source, options.sourceGeneration);
      const sourceHead = await headOf(sourceFile);
      if (!sourceHead) {
        throw new Error(`コピー元が見つかりません: ${source.bucket}/${source.path}`);
      }
      const destinationFile = fileOf(destination);
      // file.copy は rewrite を完了まで繰り返す（大きなファイル・別ロケーションでは複数回の要求になる）
      await sourceFile.copy(destinationFile, {
        cacheControl: options.cacheControl,
        contentType: sourceHead.contentType ?? undefined,
        contentDisposition: contentDispositionFor(sourceHead.contentType),
        preconditionOpts: { ifGenerationMatch: 0 },
      });
      return requireHead(destinationFile);
    },

    async delete(location, options) {
      try {
        await fileOf(location).delete(
          options?.generation ? { ifGenerationMatch: options.generation } : {},
        );
      } catch (error) {
        const code = errorCode(error);
        // 404 = すでに無い / 412 = 指定の世代はもう無い（別の世代に置き換わっている）
        if (code === 404 || code === 412) return;
        throw error;
      }
    },

    async signRead(location, options) {
      const [url] = await fileOf(location, options.generation).getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + options.ttlSec * 1000,
        responseDisposition: options.responseDisposition ?? "attachment",
        ...(options.generation ? { queryParams: { generation: options.generation } } : {}),
      });
      return url;
    },
  };
}
