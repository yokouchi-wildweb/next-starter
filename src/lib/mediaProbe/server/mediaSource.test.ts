// src/lib/mediaProbe/server/mediaSource.test.ts
// mediaSource の単体テスト（fetch を差し替え、StoragePort は fake）。
// - Range に 200（全体）が返ったとき、要求した長さを超える全体は読まずに中止する（R03）
// - 旧バケットだけを署名し、pub / priv の保存先と重なる位置・storage ref は lib で扱わない
// 実行: pnpm test:media-probe

import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import { __setStoragePortForTest, createFakeStoragePort } from "@/lib/storage/server/fake";

import { createMediaSource, fetchRangeRaw } from "./mediaSource";
import { ProbeEngineError } from "./engine/types";

const ENV_KEYS = ["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "STORAGE_PRIVATE_BUCKET", "STORAGE_PRIVATE_PREFIX", "STORAGE_PUBLIC_BUCKET"] as const;
const savedEnv: Record<string, string | undefined> = {};
const originalFetch = globalThis.fetch;

type FetchCall = { url: string; range: string | null };
let calls: FetchCall[] = [];
/** 読まれたバイト数（本体を全部読んだかの確認用） */
let pulled = 0;

/** 指定の大きさの本体を 64KiB ずつ流すストリーム */
function streamOf(size: number): ReadableStream<Uint8Array> {
  let sent = 0;
  return new ReadableStream({
    pull(controller) {
      if (sent >= size) {
        controller.close();
        return;
      }
      const chunk = Math.min(64 * 1024, size - sent);
      sent += chunk;
      pulled += chunk;
      controller.enqueue(new Uint8Array(chunk));
    },
  });
}

function useFetch(respond: (call: FetchCall) => Response) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const call = { url: String(input), range: headers.get("range") };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
}

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  calls = [];
  pulled = 0;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  __setStoragePortForTest(null);
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

const isFetchFailed = (error: unknown) => error instanceof ProbeEngineError && error.code === "fetch_failed";

describe("fetchRangeRaw", () => {
  test("206 は要求した区間を返す", async () => {
    useFetch(() => new Response(new Uint8Array(10), { status: 206 }));
    const result = await fetchRangeRaw("https://x.test/a", 100, 10);
    assert.equal(result.bytes.byteLength, 10);
    assert.equal(result.isFull, false);
    assert.equal(calls[0].range, "bytes=100-109");
  });

  test("200 でも全体が要求した長さに収まる小さなファイルは受け入れる", async () => {
    useFetch(() => new Response(new Uint8Array(5), { status: 200 }));
    const result = await fetchRangeRaw("https://x.test/a", 0, 10);
    assert.equal(result.bytes.byteLength, 5);
    assert.equal(result.isFull, true);
  });

  test("200 で content-length が大きいなら本体を読まずに中止する", async () => {
    const size = 50 * 1024 * 1024;
    useFetch(() => new Response(streamOf(size), { status: 200, headers: { "content-length": String(size) } }));
    await assert.rejects(fetchRangeRaw("https://x.test/a", 0, 4 * 1024 * 1024), isFetchFailed);
    assert.ok(pulled < 1024 * 1024, `読み込んだ量: ${pulled}`);
  });

  test("200 で content-length が無くても、要求した長さを超えた時点で中止する", async () => {
    const size = 50 * 1024 * 1024;
    useFetch(() => new Response(streamOf(size), { status: 200 }));
    await assert.rejects(fetchRangeRaw("https://x.test/a", 0, 1024 * 1024), isFetchFailed);
    assert.ok(pulled < 2 * 1024 * 1024, `読み込んだ量: ${pulled}`);
  });

  test("206 でも要求より大きな本体は読まない", async () => {
    useFetch(() => new Response(streamOf(1024 * 1024), { status: 206 }));
    await assert.rejects(fetchRangeRaw("https://x.test/a", 0, 1000), isFetchFailed);
  });
});

describe("createMediaSource の参照の解決", () => {
  const PREFETCH = { headBytes: 0, tailBytes: 0 };

  test("authorizedUrl はそのまま使い、署名しない", async () => {
    useFetch(() => new Response(new Uint8Array(1), { status: 206, headers: { "content-range": "bytes 0-0/1234" } }));
    const source = await createMediaSource({ authorizedUrl: "https://signed.test/a?sig=1" }, 120, PREFETCH);
    assert.equal(source.url, "https://signed.test/a?sig=1");
    assert.equal(source.sizeBytes, 1234);
  });

  test("サイズの確認（bytes=0-0）に 200 が返っても本体は読まない", async () => {
    const size = 50 * 1024 * 1024;
    useFetch(() => new Response(streamOf(size), { status: 200, headers: { "content-length": String(size) } }));
    const source = await createMediaSource({ authorizedUrl: "https://signed.test/a" }, 120, PREFETCH);
    assert.equal(source.sizeBytes, size);
    assert.ok(pulled < 1024 * 1024, `読み込んだ量: ${pulled}`);
  });

  test("旧バケットの storagePath / downloadUrl はその世代で署名する", async () => {
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "old";
    const fake = createFakeStoragePort();
    __setStoragePortForTest(fake);
    await fake.put({ bucket: "old", path: "uploads/a.mp4" }, new Uint8Array(7), { contentType: "video/mp4", cacheControl: "x" });

    const byPath = await createMediaSource({ storagePath: "uploads/a.mp4" }, 120, PREFETCH);
    assert.match(byPath.url ?? "", /^fake-storage:\/\/read\/old\/uploads\/a\.mp4\?/);
    assert.match(byPath.url ?? "", /ttl=120/);
    assert.match(byPath.url ?? "", /generation=/);
    assert.equal(byPath.sizeBytes, 7);
    assert.equal(byPath.contentType, "video/mp4");

    const byUrl = await createMediaSource(
      { downloadUrl: "https://firebasestorage.googleapis.com/v0/b/old/o/uploads%2Fa.mp4?alt=media&token=t" },
      120,
      PREFETCH,
    );
    assert.match(byUrl.url ?? "", /^fake-storage:\/\/read\/old\/uploads\/a\.mp4\?/);
  });

  test("pub / priv の保存先と重なる storagePath・旧 URL は署名しない", async () => {
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "old";
    process.env.STORAGE_PRIVATE_BUCKET = "old";
    process.env.STORAGE_PRIVATE_PREFIX = "priv";
    const fake = createFakeStoragePort();
    __setStoragePortForTest(fake);
    await fake.put({ bucket: "old", path: "priv/chatRoom.video/x.mp4" }, new Uint8Array(7), { contentType: "video/mp4", cacheControl: "x" });

    await assert.rejects(createMediaSource({ storagePath: "priv/chatRoom.video/x.mp4" }, 120, PREFETCH), isFetchFailed);

    // 自分の旧バケットとして扱われない URL は、署名せずにそのまま取得する（非公開バケットなら取得できない）
    useFetch(() => new Response(null, { status: 403 }));
    await assert.rejects(
      createMediaSource({ downloadUrl: "https://storage.googleapis.com/old/priv/chatRoom.video/x.mp4" }, 120, PREFETCH),
      isFetchFailed,
    );
    assert.equal(calls[0].url, "https://storage.googleapis.com/old/priv/chatRoom.video/x.mp4");
  });

  test("storage の ref は lib で解決しない（呼び出し元が認可して authorizedUrl で渡す）", async () => {
    await assert.rejects(
      createMediaSource({ downloadUrl: "storage://priv/chatRoom.video/01920000-0000-7000-8000-000000000001.mp4" }, 120, PREFETCH),
      isFetchFailed,
    );
  });
});
