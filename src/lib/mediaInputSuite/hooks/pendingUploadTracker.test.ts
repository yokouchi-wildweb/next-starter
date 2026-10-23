// src/lib/mediaInputSuite/hooks/pendingUploadTracker.test.ts
// usePendingMediaUploads の中身（pendingUploadTracker）の単体テスト。
// discard するのは「このセッションで上げて最終値に残らなかった storage ref」だけで、初期値・旧 URL・確定した値は送らないことを確かめる。
// 実行: pnpm test:storage-client

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { createPendingUploadTracker } from "./pendingUploadTracker";

const ID_A = "01920000-0000-7000-8000-00000000000a";
const ID_B = "01920000-0000-7000-8000-00000000000b";
const ID_C = "01920000-0000-7000-8000-00000000000c";
const ref = (id: string) => `storage://pub/sample.main_image/${id}.png`;

function harness(failFor: string[] = []) {
  const discarded: string[] = [];
  const errors: unknown[] = [];
  const tracker = createPendingUploadTracker({
    discard: async (objectId) => {
      discarded.push(objectId);
      if (failFor.includes(objectId)) throw new Error("network");
    },
    onError: (error) => errors.push(error),
  });
  return { tracker, discarded, errors };
}

describe("未採用分の discard", () => {
  test("差し替えで残らなかった ref だけを discard し、最終値は discard しない", async () => {
    const h = harness();
    h.tracker.register(ref(ID_A));
    h.tracker.register(ref(ID_B));
    h.tracker.commit(ref(ID_B));
    await h.tracker.cleanup();
    assert.deepEqual(h.discarded, [ID_A]);
  });

  test("旧 URL・\"/\" 始まり・空は登録されても送らない（採用済みの旧物はクライアントから消さない）", async () => {
    const h = harness();
    h.tracker.register("https://firebasestorage.googleapis.com/v0/b/x/o/sample%2Fmain%2Fa.png?alt=media&token=t");
    h.tracker.register("/images/a.png");
    h.tracker.register(null);
    h.tracker.register("");
    await h.tracker.cleanup();
    assert.deepEqual(h.discarded, []);
  });

  test("登録していない値（初期値として読み込んだ ref）は discard しない", async () => {
    const h = harness();
    h.tracker.register(ref(ID_A));
    // ID_C は初期値（業務行に保存済み）。clear されても register されない限り送らない
    h.tracker.commit(ref(ID_C));
    await h.tracker.cleanup();
    assert.deepEqual(h.discarded, [ID_A]);
  });

  test("cleanup の後にもう一度 cleanup しても二重に送らない", async () => {
    const h = harness();
    h.tracker.register(ref(ID_A));
    await h.tracker.cleanup();
    await h.tracker.cleanup();
    assert.deepEqual(h.discarded, [ID_A]);
    assert.deepEqual(h.tracker.pending(), []);
  });

  test("discard の失敗は記録だけして残りを続ける（残りは掃除 cron が拾う）", async () => {
    const h = harness([ID_A]);
    h.tracker.register(ref(ID_A));
    h.tracker.register(ref(ID_B));
    await h.tracker.cleanup();
    assert.deepEqual(h.discarded.sort(), [ID_A, ID_B]);
    assert.equal(h.errors.length, 1);
  });
});
