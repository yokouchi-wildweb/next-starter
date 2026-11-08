// src/lib/storage/client/purposePolicy.test.ts
// 用途の方針の取得と記憶（purposePolicy.ts）の単体テスト。HTTP は偽の client で置き換える。
// 実行: pnpm test src/lib/storage/client/purposePolicy.test.ts

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { createPurposeMetadataLoader } from "./purposePolicy";
import type { PurposePolicyResponse } from "./transferTypes";

function fakeClient(
  answers: Record<string, PurposePolicyResponse["metadata"]>,
  failures = new Set<string>(),
  images: Record<string, PurposePolicyResponse["image"]> = {},
) {
  const calls: string[] = [];
  return {
    calls,
    failures,
    client: {
      policy: async (purpose: string): Promise<PurposePolicyResponse> => {
        calls.push(purpose);
        if (failures.has(purpose)) throw new Error("失敗");
        const metadata = answers[purpose];
        if (!metadata) throw new Error("404");
        return { metadata, image: images[purpose] ?? null };
      },
    },
  };
}

describe("用途の方針の取得と記憶", () => {
  test("サーバーの答えを返し、同じ用途は 1 回だけ問い合わせる（同時の呼び出しもまとめる）", async () => {
    const f = fakeClient({ "user.avatar": "strip", "chatRoom.file": "keep" });
    const loader = createPurposeMetadataLoader(f.client);
    assert.equal(loader.peek("user.avatar"), undefined);
    const [a, b] = await Promise.all([loader.load("user.avatar"), loader.load("user.avatar")]);
    assert.equal(a, "strip");
    assert.equal(b, "strip");
    assert.equal(await loader.load("chatRoom.file"), "keep");
    assert.equal(await loader.load("user.avatar"), "strip");
    assert.deepEqual(f.calls, ["user.avatar", "chatRoom.file"]);
    assert.equal(loader.peek("user.avatar"), "strip");
    assert.equal(loader.peek("chatRoom.file"), "keep");
  });

  test("失敗は記憶せず、次の呼び出しで取り直す", async () => {
    const f = fakeClient({ "user.avatar": "strip" }, new Set(["user.avatar"]));
    const loader = createPurposeMetadataLoader(f.client);
    await assert.rejects(loader.load("user.avatar"));
    assert.equal(loader.peek("user.avatar"), undefined);
    f.failures.clear();
    assert.equal(await loader.load("user.avatar"), "strip");
    assert.deepEqual(f.calls, ["user.avatar", "user.avatar"]);
  });

  test("未登録の用途（404）は reject し、記憶しない", async () => {
    const f = fakeClient({});
    const loader = createPurposeMetadataLoader(f.client);
    await assert.rejects(loader.load("unknown.field"));
    await assert.rejects(loader.load("unknown.field"));
    assert.equal(f.calls.length, 2);
  });

  test("loadPolicy は方針の全体（metadata と image）を返し、load と 1 回の取得を共有する", async () => {
    const f = fakeClient({ "album.photo": "strip", "user.avatar": "strip" }, new Set(), { "album.photo": { maxDimension: 2048, quality: 80 } });
    const loader = createPurposeMetadataLoader(f.client);
    assert.equal(loader.peekPolicy("album.photo"), undefined);
    const [policy, metadata] = await Promise.all([loader.loadPolicy("album.photo"), loader.load("album.photo")]);
    assert.deepEqual(policy, { metadata: "strip", image: { maxDimension: 2048, quality: 80 } });
    assert.equal(metadata, "strip");
    assert.deepEqual(loader.peekPolicy("album.photo"), policy);
    assert.deepEqual(await loader.loadPolicy("user.avatar"), { metadata: "strip", image: null });
    assert.deepEqual(f.calls, ["album.photo", "user.avatar"]);
  });

  test("loadPolicy の失敗も記憶せず取り直す（load の記憶とも共通）", async () => {
    const f = fakeClient({ "album.photo": "strip" }, new Set(["album.photo"]));
    const loader = createPurposeMetadataLoader(f.client);
    await assert.rejects(loader.loadPolicy("album.photo"));
    assert.equal(loader.peek("album.photo"), undefined);
    f.failures.clear();
    assert.equal(await loader.load("album.photo"), "strip");
    assert.deepEqual(loader.peekPolicy("album.photo"), { metadata: "strip", image: null });
    assert.equal(f.calls.length, 2);
  });
});
