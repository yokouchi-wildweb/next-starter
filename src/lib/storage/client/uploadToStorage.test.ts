// src/lib/storage/client/uploadToStorage.test.ts
// uploadToStorage（T4）の単体テスト。axios の adapter を差し替えて、アプリのルートと GCS を偽物にする。
// put と session の往復・中止 → discard・失敗 → discard・再開・画像の描き直し（偽の codec）を確かめる。
// 本物のブラウザ（XHR の進捗・中止、canvas の描き直し）は MediaUploader の切替（T9）で確かめる。
// 実行: pnpm test:storage-client

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import axios, { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

import { HttpError } from "@/lib/errors";

import { nextOffsetFromRange, sessionRetryDelayMs } from "./drivers/gcsSession";
import { reencodeImage, type ImageCodec } from "./reencodeImage";
import { createStorageClient } from "./storageClient";
import { isStorageUploadCanceled, type UploadedFile, type UploadProgress } from "./transferTypes";
import { createUploader } from "./uploadToStorage";

const MiB = 1024 * 1024;
const SESSION_THRESHOLD = 16 * MiB;

type Call = { method: string; url: string; headers: Record<string, unknown>; size: number | null };

type FakeServer = {
  calls: Call[];
  /** 送られてきた本体（PUT の Blob） */
  bodies: Blob[];
  options: {
    putStatus?: number;
    commitStatus?: number;
    issueStatus?: number;
    /** session の n 回目の chunk を通信エラーにする（1 始まり） */
    dropSessionChunk?: number;
    /** session の n 回目の chunk 送信（1 始まり）に返す失敗の状態。受け取りは進まない */
    sessionChunkStatuses?: Record<number, number>;
    /** PUT を中止されるまで待たせる */
    holdPut?: boolean;
  };
};

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown = null, headers: Record<string, string> = {}) {
  const response: AxiosResponse = { data, status, statusText: String(status), headers, config };
  const validate = config.validateStatus ?? ((s: number) => s >= 200 && s < 300);
  if (validate(status)) return response;
  throw new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_RESPONSE, config, null, response);
}

function sizeOf(data: unknown): number | null {
  return data instanceof Blob ? data.size : null;
}

function fakeServer(options: FakeServer["options"] = {}) {
  const server: FakeServer = { calls: [], bodies: [], options };
  let sessionReceived = 0;
  let sessionChunk = 0;

  const adapter: AxiosAdapter = async (config) => {
    const method = (config.method ?? "get").toUpperCase();
    const url = config.url ?? "";
    server.calls.push({ method, url, headers: { ...(config.headers ?? {}) }, size: sizeOf(config.data) });
    if (config.signal?.aborted) throw new axios.CanceledError();

    if (method === "POST" && url === "/api/me/storage/uploads") {
      if (options.issueStatus) return respond(config, options.issueStatus, { message: "未完了のアップロードが多すぎます" });
      const input = JSON.parse(config.data as string) as { purpose: string; contentType: string; size: number };
      const objectId = "01920000-0000-7000-8000-000000000001";
      const transfer =
        input.size > SESSION_THRESHOLD
          ? { kind: "gcsSession", sessionUrl: "https://storage.example.test/session/1" }
          : { kind: "put", url: "https://storage.example.test/put/1", headers: { "x-goog-if-generation-match": "0" } };
      return respond(config, 200, { objectId, ref: `storage://pub/${input.purpose}/${objectId}.png`, transfer, expiresAt: "x" });
    }
    if (method === "POST" && url.endsWith("/commit")) {
      if (options.commitStatus) return respond(config, options.commitStatus, { message: "一致しません" });
      return respond(config, 200, { ref: "storage://pub/user.avatar/01920000-0000-7000-8000-000000000001.png", src: "https://cdn/x.png", size: 3, contentType: "image/png" });
    }
    if (method === "DELETE" && url.startsWith("/api/me/storage/uploads/")) return respond(config, 200, { ok: true });

    if (method === "PUT" && url.includes("/put/")) {
      if (config.data instanceof Blob) server.bodies.push(config.data);
      if (options.holdPut) {
        await new Promise((_, reject) => config.signal?.addEventListener?.("abort", () => reject(new axios.CanceledError())));
      }
      config.onUploadProgress?.({ loaded: sizeOf(config.data) ?? 0, total: sizeOf(config.data) ?? 0, bytes: 0, lengthComputable: true });
      return respond(config, options.putStatus ?? 200);
    }

    if (method === "PUT" && url.includes("/session/")) {
      const range = String((config.headers as Record<string, unknown>)?.["Content-Range"] ?? "");
      const total = Number(range.split("/")[1]);
      if (range.startsWith("bytes */")) {
        return sessionReceived >= total ? respond(config, 200) : respond(config, 308, null, sessionReceived ? { range: `bytes=0-${sessionReceived - 1}` } : {});
      }
      sessionChunk += 1;
      if (options.dropSessionChunk === sessionChunk) {
        // 通信の途切れ（応答なし）。受け取りは途中で止まった扱い
        throw new AxiosError("Network Error", AxiosError.ERR_NETWORK, config);
      }
      const failStatus = options.sessionChunkStatuses?.[sessionChunk];
      if (failStatus) return respond(config, failStatus, { message: `status ${failStatus}` });
      const [start, end] = range.replace("bytes ", "").split("/")[0].split("-").map(Number);
      if (start !== sessionReceived) return respond(config, 400, { message: `unexpected offset ${start}` });
      sessionReceived = end + 1;
      return sessionReceived >= total ? respond(config, 200) : respond(config, 308, null, { range: `bytes=0-${sessionReceived - 1}` });
    }
    return respond(config, 404);
  };

  const http = axios.create({ adapter });
  return { server, http };
}

const identityCodec: ImageCodec = { available: () => true, redraw: async (file, type) => new Blob([file], { type }) };

function harness(options: FakeServer["options"] = {}, codec: ImageCodec = identityCodec) {
  const { server, http } = fakeServer(options);
  const retryDelays: number[] = [];
  const upload = createUploader({
    client: createStorageClient(http),
    transferHttp: http,
    codec,
    // 待ち時間は記録だけして待たない
    sessionRetryDelayMs: (attempt) => {
      retryDelays.push(attempt);
      return 0;
    },
  });
  const run = (file: Blob, extra: Partial<Parameters<typeof upload>[1]> = {}) =>
    new Promise<{ result?: UploadedFile; error?: Error; progress: UploadProgress[]; handle: ReturnType<typeof upload> }>((resolve) => {
      const progress: UploadProgress[] = [];
      const handle = upload(file, {
        purpose: "user.avatar",
        onProgress: (p) => progress.push(p),
        onComplete: (result) => resolve({ result, progress, handle }),
        onError: (error) => resolve({ error, progress, handle }),
        ...extra,
      });
    });
  return { server, run, upload, retryDelays };
}

const png = (size = 3) => new Blob([new Uint8Array(size)], { type: "image/png" });

describe("uploadToStorage の往復", () => {
  test("小さいファイルは単発 PUT（署名ヘッダー付き）→ commit", async () => {
    const h = harness();
    const { result, error, progress } = await h.run(png());
    assert.equal(error, undefined);
    assert.equal(result?.objectId, "01920000-0000-7000-8000-000000000001");
    assert.match(result?.ref ?? "", /^storage:\/\//);
    const put = h.server.calls.find((c) => c.method === "PUT");
    assert.equal(put?.headers["x-goog-if-generation-match"], "0");
    assert.deepEqual(h.server.calls.map((c) => c.method), ["POST", "PUT", "POST"]);
    assert.equal(progress.at(-1)?.percent, 100);
  });

  test("16MiB を超えるファイルは GCS セッションで chunk に分けて送り、通信の途切れから再開する", async () => {
    const h = harness({ dropSessionChunk: 2 });
    const file = new Blob([new Uint8Array(17 * MiB)], { type: "video/mp4" });
    const { result, error, progress } = await h.run(file, { purpose: "chat.video" });
    assert.equal(error, undefined);
    assert.ok(result);
    const ranges = h.server.calls.filter((c) => c.url.includes("/session/")).map((c) => String(c.headers["Content-Range"]));
    assert.ok(ranges.includes(`bytes */${17 * MiB}`), "途切れの後に状態を照会する");
    assert.equal(ranges.at(-1), `bytes ${16 * MiB}-${17 * MiB - 1}/${17 * MiB}`);
    assert.equal(progress.at(-1)?.percent, 100);
  });
});

describe("セッション送信の再試行（408 / 429 / 5xx）", () => {
  const big = () => new Blob([new Uint8Array(17 * MiB)], { type: "video/mp4" });
  const sessionRanges = (h: ReturnType<typeof harness>) =>
    h.server.calls.filter((c) => c.url.includes("/session/")).map((c) => String(c.headers["Content-Range"]));

  test("503 を受けたら待ってから状態を照会し、続きから送って完了する", async () => {
    const h = harness({ sessionChunkStatuses: { 2: 503 } });
    const { result, error } = await h.run(big(), { purpose: "chat.video" });
    assert.equal(error, undefined);
    assert.ok(result);
    assert.deepEqual(h.retryDelays, [1], "1 回目の待ち");
    const ranges = sessionRanges(h);
    const query = ranges.indexOf(`bytes */${17 * MiB}`);
    assert.ok(query > 0, "失敗の後に照会する");
    assert.equal(ranges[query + 1], `bytes ${8 * MiB}-${16 * MiB - 1}/${17 * MiB}`, "受け取り済みの続きから");
  });

  test("408 / 429 / 500 / 502 / 504 も再試行する。前進したら数え直す", async () => {
    const h = harness({ sessionChunkStatuses: { 1: 408, 2: 429, 4: 500, 5: 502, 7: 504 } });
    const { result, error } = await h.run(big(), { purpose: "chat.video" });
    assert.equal(error, undefined);
    assert.ok(result);
    // chunk1: 408 → 1, 429 → 2, 成功（前進）/ chunk2: 500 → 1, 502 → 2, 成功 / chunk3: 504 → 1
    assert.deepEqual(h.retryDelays, [1, 2, 1, 2, 1]);
  });

  test("連続 4 回目の失敗で終わり、取り消す", async () => {
    const h = harness({ sessionChunkStatuses: { 1: 503, 2: 503, 3: 503, 4: 503 } });
    const { error } = await h.run(big(), { purpose: "chat.video" });
    assert.ok(error instanceof HttpError);
    assert.equal((error as HttpError).status, 503);
    assert.deepEqual(h.retryDelays, [1, 2, 3]);
    assert.ok(h.server.calls.some((c) => c.method === "DELETE"));
  });

  test("400 / 403 などは再試行しない", async () => {
    const h = harness({ sessionChunkStatuses: { 1: 403 } });
    const { error } = await h.run(big(), { purpose: "chat.video" });
    assert.equal((error as HttpError).status, 403);
    assert.deepEqual(h.retryDelays, []);
    assert.equal(sessionRanges(h).length, 1, "照会もしない");
  });

  test("単発 PUT の 503 は再試行しない", async () => {
    const h = harness({ putStatus: 503 });
    const { error } = await h.run(png());
    assert.equal((error as HttpError).status, 503);
    assert.equal(h.server.calls.filter((c) => c.method === "PUT").length, 1);
  });

  test("待ち時間は 1s・2s・4s の指数 + 0〜500ms の揺らぎ", () => {
    assert.equal(sessionRetryDelayMs(1, () => 0), 1000);
    assert.equal(sessionRetryDelayMs(2, () => 0), 2000);
    assert.equal(sessionRetryDelayMs(3, () => 0.999), 4499);
  });

  test("待っている間に中止したら storage/canceled で終わる", async () => {
    const { http } = fakeServer({ sessionChunkStatuses: { 1: 503 } });
    const upload = createUploader({
      client: createStorageClient(http),
      transferHttp: http,
      codec: identityCodec,
      sessionRetryDelayMs: () => 60_000,
    });
    const errors: Error[] = [];
    const handle = upload(big(), { purpose: "chat.video", onError: (e) => errors.push(e) });
    await new Promise((resolve) => setTimeout(resolve, 30));
    handle.cancel();
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(isStorageUploadCanceled(errors[0]), true);
  });
});

describe("中止と失敗", () => {
  test("中止すると storage/canceled で終わり、発行済みなら取り消す", async () => {
    const h = harness({ holdPut: true });
    const errors: Error[] = [];
    const handle = h.upload(png(), { purpose: "user.avatar", onError: (e) => errors.push(e) });
    await new Promise((resolve) => setTimeout(resolve, 20));
    handle.cancel();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(isStorageUploadCanceled(errors[0]), true);
    assert.ok(h.server.calls.some((c) => c.method === "DELETE" && c.url === "/api/me/storage/uploads/01920000-0000-7000-8000-000000000001"));
  });

  test("GCS が拒否したら HttpError で終わり、取り消す", async () => {
    const h = harness({ putStatus: 403 });
    const { error } = await h.run(png());
    assert.ok(error instanceof HttpError);
    assert.equal((error as HttpError).status, 403);
    assert.ok(h.server.calls.some((c) => c.method === "DELETE"));
  });

  test("commit が拒否（422）されても取り消しを試み、サーバーのメッセージで終わる", async () => {
    const h = harness({ commitStatus: 422 });
    const { error } = await h.run(png());
    assert.equal((error as HttpError).status, 422);
    assert.equal(error?.message, "一致しません");
    assert.ok(h.server.calls.some((c) => c.method === "DELETE"));
  });

  test("発行が拒否（429）されたら転送も取り消しもしない", async () => {
    const h = harness({ issueStatus: 429 });
    const { error } = await h.run(png());
    assert.equal((error as HttpError).status, 429);
    assert.deepEqual(h.server.calls.map((c) => c.method), ["POST"]);
  });
});

describe("画像の描き直し", () => {
  test("jpeg / png / webp は描き直した方を送る。小さい画像も通る", async () => {
    const redrawn: string[] = [];
    const codec: ImageCodec = {
      available: () => true,
      redraw: async (_file, type) => {
        redrawn.push(type);
        return new Blob([new Uint8Array(5)], { type });
      },
    };
    const h = harness({}, codec);
    const { error } = await h.run(new Blob([new Uint8Array(1)], { type: "image/jpeg" }));
    assert.equal(error, undefined);
    assert.deepEqual(redrawn, ["image/jpeg"]);
    assert.equal(h.server.bodies[0]?.size, 5, "描き直した方（EXIF なし）を送る");
  });

  test("gif は素通し、reencodeImage:false なら描き直さない", async () => {
    const calls: string[] = [];
    const codec: ImageCodec = { available: () => true, redraw: async (file, type) => (calls.push(type), file) };
    const gif = new Blob([new Uint8Array(4)], { type: "image/gif" });
    assert.equal(await reencodeImage(gif, codec), gif);
    const h = harness({}, codec);
    await h.run(png(), { reencodeImage: false });
    assert.deepEqual(calls, []);
  });

  test("描き直せない環境では元のまま送る", async () => {
    const codec: ImageCodec = { available: () => false, redraw: async () => assert.fail("呼ばれない") };
    const file = new Blob([new Uint8Array(4)], { type: "image/webp" });
    const original = console.warn;
    console.warn = () => {};
    try {
      assert.equal(await reencodeImage(file, codec), file);
    } finally {
      console.warn = original;
    }
  });
});

test("Range ヘッダーから次の位置を読む", () => {
  assert.equal(nextOffsetFromRange("bytes=0-262143"), 262144);
  assert.equal(nextOffsetFromRange(undefined), 0);
});
