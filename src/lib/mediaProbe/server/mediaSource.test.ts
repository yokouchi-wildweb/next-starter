// src/lib/mediaProbe/server/mediaSource.test.ts
// mediaSource の単体テスト（fetch を差し替え、StoragePort は fake）。
// - Range に 200（全体）が返ったとき、要求した長さを超える全体は読まずに中止する（R03）
// - 旧バケットだけを署名し、pub / priv の保存先と重なる位置・storage ref は lib で扱わない
// - Next のサーバー内の fetch（signal の無い GET の応答を tee する dedupe-fetch）でも止まらない。期限で通信を打ち切る
// 実行: pnpm test:media-probe

import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import { __setStoragePortForTest, createFakeStoragePort } from "@/lib/storage/server/fake";

import { createMediaSource, fetchRangeRaw } from "./mediaSource";
import { ProbeEngineError } from "./engine/types";
import type { ProbeEngine } from "./engine/types";
import { probeMedia } from "./probeMedia";

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

/** tee の保持側（GC で閉じられないよう参照を持ち続ける） */
let retained: ReadableStream<Uint8Array>[] = [];
/** 各 fetch に渡された signal（無ければ null） */
let signals: (AbortSignal | null)[] = [];

/**
 * Next のサーバー内の fetch を模す（next/dist/server/lib/dedupe-fetch.js）。
 * signal の無い GET は応答の本体を tee し、片方を保持して閉じない。保持側があるとき、
 * もう片方の cancel() は両方が閉じるまで解決しない。signal があれば tee しない。
 */
function useDedupeFetch(respond: (call: FetchCall) => Response) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const call = { url: String(input), range: headers.get("range") };
    calls.push(call);
    signals.push(init?.signal ?? null);
    const res = respond(call);
    if (init?.signal || !res.body) return res;
    const [mine, kept] = res.body.tee();
    retained.push(kept);
    return new Response(mine, { status: res.status, statusText: res.statusText, headers: res.headers });
  }) as typeof fetch;
}

/** ms 以内に終わらなければ失敗にする（止まる不具合を期限で検出する） */
async function within<T>(ms: number, promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${ms}ms 以内に終わらなかった（止まっている）`)), ms);
  });
  try {
    return await Promise.race([promise, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  calls = [];
  pulled = 0;
  retained = [];
  signals = [];
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

describe("Next のサーバー内の fetch（応答の tee）でも止まらない", () => {
  const PREFETCH = { headBytes: 0, tailBytes: 0 };

  test("authorizedUrl・大きさ無しのサイズ確認（bytes=0-0）が止まらない", async () => {
    useDedupeFetch(() => new Response(streamOf(1), { status: 206, headers: { "content-range": "bytes 0-0/1234" } }));
    const source = await within(1000, createMediaSource({ authorizedUrl: "https://signed.test/a" }, 120, PREFETCH));
    assert.equal(source.sizeBytes, 1234);
  });

  test("200 で content-length が大きいとき、読まずにすぐ中止する", async () => {
    const size = 50 * 1024 * 1024;
    useDedupeFetch(() => new Response(streamOf(size), { status: 200, headers: { "content-length": String(size) } }));
    await assert.rejects(within(1000, fetchRangeRaw("https://x.test/a", 0, 1024 * 1024)), isFetchFailed);
  });

  test("200 で読みながら長さを超えたとき、すぐ中止する", async () => {
    useDedupeFetch(() => new Response(streamOf(50 * 1024 * 1024), { status: 200 }));
    await assert.rejects(within(1000, fetchRangeRaw("https://x.test/a", 0, 1024 * 1024)), isFetchFailed);
  });

  test("サイズ確認・プリフェッチ・窓外の読み取りのすべての fetch に signal を渡す", async () => {
    useDedupeFetch((call) => {
      const [start, end] = (call.range ?? "bytes=0-0").slice("bytes=".length).split("-").map(Number);
      return new Response(new Uint8Array(end - start + 1), {
        status: 206,
        headers: { "content-range": `bytes ${start}-${end}/100000` },
      });
    });
    const source = await within(1000, createMediaSource({ authorizedUrl: "https://signed.test/a" }, 120, { headBytes: 100, tailBytes: 100 }));
    await within(1000, source.readChunk(50_000, 10));
    assert.equal(signals.length, 4);
    assert.ok(signals.every((signal) => signal !== null));
  });
});

describe("probeMedia の期限", () => {
  test("期限で通信を打ち切り、timeout を返す", async () => {
    // 応答を返さず、signal が abort されたときだけ失敗する fetch
    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
      signals.push(init?.signal ?? null);
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
    }) as typeof fetch;
    const engine: ProbeEngine = {
      name: "test",
      probe: async () => {
        throw new Error("呼ばれない");
      },
    };

    const result = await within(1000, probeMedia({ authorizedUrl: "https://signed.test/a" }, { engine, timeoutMs: 50 }));
    assert.equal(result.ok, false);
    assert.equal(result.ok ? null : result.error.code, "timeout");
    assert.equal(signals.length, 1);
    assert.equal(signals[0]?.aborted, true);
  });

  test("tee される fetch でも、大きさ無しの authorizedUrl を解析できる", async () => {
    useDedupeFetch((call) => {
      const [start, end] = (call.range ?? "bytes=0-0").slice("bytes=".length).split("-").map(Number);
      return new Response(streamOf(end - start + 1), {
        status: 206,
        headers: { "content-range": `bytes ${start}-${end}/2048` },
      });
    });
    const engine: ProbeEngine = {
      name: "test",
      probe: async (source) => {
        const head = await source.readChunk(0, 16);
        assert.equal(head.byteLength, 16);
        return { container: "mp4", durationSec: 1, hasVideoTrack: true, hasAudioTrack: false, video: null, audio: null };
      },
    };

    const result = await within(1000, probeMedia({ authorizedUrl: "https://signed.test/a" }, { engine, timeoutMs: 5000 }));
    assert.equal(result.ok, true);
  });
});
