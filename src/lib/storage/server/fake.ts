// src/lib/storage/server/fake.ts
//
// テスト用の StoragePort（メモリ上の Map）。GCS 実装と同じ約束（上書き不可・発行時 no-store・
// Content-Disposition の自動付与・世代指定）を守る。ブラウザからの送信は simulateUpload で再現する。
//
// 使い方:
//   const fake = createFakeStoragePort();
//   __setStoragePortForTest(fake);   // 以後 getStoragePort() が fake を返す
//   ...
//   __setStoragePortForTest(null);   // 元に戻す

import "server-only";

import { contentDispositionFor } from "../contentTypes";
import {
  ISSUED_CACHE_CONTROL,
  StorageReadTooLargeError,
  setStoragePortOverride,
  type HeadResult,
  type ObjectLocation,
  type StoragePort,
} from "./port";

export type FakeStoredObject = {
  body: Uint8Array;
  contentType: string | null;
  cacheControl: string;
  contentDisposition: string;
  generation: string;
};

type FakeGrant = {
  kind: "put" | "session";
  location: ObjectLocation;
  contentType: string;
  /** put のみ: 署名に含めたサイズの上限 */
  maxBytes: number | null;
  expiresAt: Date | null;
};

/** GCS のエラーと同じく数値の code を持つ（404 / 412 / 400 / 403） */
export class FakeStorageError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = "FakeStorageError";
    this.code = code;
  }
}

export type FakeStoragePort = StoragePort & {
  /** 保存中のオブジェクト（キー = `<bucket>/<path>`） */
  readonly objects: ReadonlyMap<string, FakeStoredObject>;
  /** 発行した PUT の URL / セッション URL に、ブラウザが送信したことにする */
  simulateUpload(
    issuedUrl: string,
    body: Uint8Array,
    options?: { contentType?: string },
  ): HeadResult;
};

const PUT_PREFIX = "fake-storage://put/";
const SESSION_PREFIX = "fake-storage://session/";

function keyOf(location: ObjectLocation): string {
  return `${location.bucket}/${location.path}`;
}

export function createFakeStoragePort(options: { now?: () => Date } = {}): FakeStoragePort {
  const now = options.now ?? (() => new Date());
  const objects = new Map<string, FakeStoredObject>();
  const grants = new Map<string, FakeGrant>();
  let generationCounter = 0;
  let grantCounter = 0;

  const nextGeneration = () => String(++generationCounter);

  const headOf = (object: FakeStoredObject): HeadResult => ({
    size: object.body.byteLength,
    contentType: object.contentType,
    generation: object.generation,
  });

  const create = (
    location: ObjectLocation,
    body: Uint8Array,
    contentType: string | null,
    cacheControl: string,
  ): HeadResult => {
    const key = keyOf(location);
    if (objects.has(key)) throw new FakeStorageError(412, `既に存在します: ${key}`);
    const object: FakeStoredObject = {
      body: new Uint8Array(body),
      contentType,
      cacheControl,
      contentDisposition: contentDispositionFor(contentType),
      generation: nextGeneration(),
    };
    objects.set(key, object);
    return headOf(object);
  };

  return {
    objects,

    async issuePut(location, opts) {
      const expiresAt = new Date(now().getTime() + opts.ttlSec * 1000);
      const url = `${PUT_PREFIX}${++grantCounter}`;
      grants.set(url, {
        kind: "put",
        location,
        contentType: opts.contentType,
        maxBytes: opts.maxBytes,
        expiresAt,
      });
      return {
        url,
        headers: {
          "content-type": opts.contentType,
          "cache-control": ISSUED_CACHE_CONTROL,
          "content-disposition": contentDispositionFor(opts.contentType),
          "x-goog-if-generation-match": "0",
          "x-goog-content-length-range": `0,${opts.maxBytes}`,
        },
        expiresAt,
      };
    },

    async issueSession(location, opts) {
      const sessionUrl = `${SESSION_PREFIX}${++grantCounter}`;
      grants.set(sessionUrl, {
        kind: "session",
        location,
        contentType: opts.contentType,
        maxBytes: null,
        expiresAt: null,
      });
      return { sessionUrl };
    },

    async cancelSession(sessionUrl) {
      const grant = grants.get(sessionUrl);
      if (grant?.kind === "session") grants.delete(sessionUrl);
    },

    async head(location) {
      const object = objects.get(keyOf(location));
      return object ? headOf(object) : null;
    },

    async setCacheControl(location, generation, value) {
      const object = objects.get(keyOf(location));
      if (!object) throw new FakeStorageError(404, `見つかりません: ${keyOf(location)}`);
      if (object.generation !== generation) {
        throw new FakeStorageError(412, `世代が一致しません: ${keyOf(location)}`);
      }
      object.cacheControl = value;
    },

    async read(location, opts) {
      const object = objects.get(keyOf(location));
      if (!object) throw new FakeStorageError(404, `見つかりません: ${keyOf(location)}`);
      if (opts.generation && object.generation !== opts.generation) {
        throw new FakeStorageError(404, `指定の世代がありません: ${keyOf(location)}`);
      }
      if (object.body.byteLength > opts.maxBytes) {
        throw new StorageReadTooLargeError(location, object.body.byteLength, opts.maxBytes);
      }
      return new Uint8Array(object.body);
    },

    async put(location, body, opts) {
      return create(location, body, opts.contentType, opts.cacheControl);
    },

    async copy(source, destination, opts) {
      const object = objects.get(keyOf(source));
      if (!object) throw new FakeStorageError(404, `コピー元が見つかりません: ${keyOf(source)}`);
      if (opts.sourceGeneration && object.generation !== opts.sourceGeneration) {
        throw new FakeStorageError(404, `指定の世代がありません: ${keyOf(source)}`);
      }
      return create(destination, object.body, object.contentType, opts.cacheControl);
    },

    async delete(location, opts) {
      const key = keyOf(location);
      const object = objects.get(key);
      if (!object) return;
      if (opts?.generation && object.generation !== opts.generation) return;
      objects.delete(key);
    },

    async signRead(location, opts) {
      const params = new URLSearchParams({
        ttl: String(opts.ttlSec),
        disposition: opts.responseDisposition ?? "attachment",
      });
      if (opts.generation) params.set("generation", opts.generation);
      return `fake-storage://read/${keyOf(location)}?${params.toString()}`;
    },

    simulateUpload(issuedUrl, body, uploadOptions = {}) {
      const grant = grants.get(issuedUrl);
      if (!grant) throw new FakeStorageError(403, `発行されていない URL です: ${issuedUrl}`);
      if (grant.expiresAt && grant.expiresAt.getTime() <= now().getTime()) {
        throw new FakeStorageError(403, `期限切れの URL です: ${issuedUrl}`);
      }
      const contentType = uploadOptions.contentType ?? grant.contentType;
      if (grant.kind === "put") {
        // 署名に含めたヘッダーと違う値は GCS が拒否する
        if (contentType !== grant.contentType) {
          throw new FakeStorageError(403, "署名と Content-Type が一致しません");
        }
        if (grant.maxBytes !== null && body.byteLength > grant.maxBytes) {
          throw new FakeStorageError(400, "サイズの上限を超えています");
        }
      }
      const head = create(grant.location, body, contentType, ISSUED_CACHE_CONTROL);
      if (grant.kind === "session") grants.delete(issuedUrl);
      return head;
    },
  };
}

/**
 * 描き直しの差し替え（テスト専用）。中身をそのまま返す。
 * strip の流れ（受け取り領域 → 本来の位置）を、画像でないダミーのバイト列で通すときに
 * createStorageObjectService の stripImage に渡す。描き直しそのものは imageStrip.test.ts が確かめる
 */
export async function passThroughImageStrip(
  body: Uint8Array,
  contentType: string,
): Promise<{ body: Uint8Array; contentType: string }> {
  return { body, contentType };
}

/** getStoragePort() が返すポートを差し替える（テスト専用）。null で GCS 実装に戻す */
export function __setStoragePortForTest(port: StoragePort | null): void {
  setStoragePortOverride(port);
}
