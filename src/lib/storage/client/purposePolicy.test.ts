// src/lib/storage/client/purposePolicy.test.ts
// 用途の方針の取得と記憶（purposePolicy.ts）の単体テスト。HTTP は偽の client で置き換える。
// 実行: pnpm test:storage-client

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { createPurposeMetadataLoader } from "./purposePolicy";
import type { PurposePolicyResponse } from "./transferTypes";

function fakeClient(answers: Record<string, PurposePolicyResponse["metadata"]>, failures = new Set<string>()) {
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
        return { metadata };
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
});
