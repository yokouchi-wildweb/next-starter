// src/domains/core/bankTransferReview/recordTargets/reviews.test.ts
// 振込審査の記録の宛先(reviews.ts)の検査。DB は偽物。
// - 宛先: 1 人 1 件(同じ人の審査はまとめる)、記録から埋める値 = 宛名(無ければ「お客様」)・金額・申告日(「、」でつなぐ)
// - 送れる連絡定義: transferCheck を名指す
// - afterSend(D196): 使う送信チャンネルに email が無ければメモを書かない、あれば審査ごとに「YYYY/MM/DD「件名」メール送付」を足す
// 実行: pnpm test src/domains/core/bankTransferReview/recordTargets/reviews.test.ts
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

import type { MessageRecordTarget, MessageRecordTargetSent } from "@/lib/messaging";

/** 審査の行(id → 管理メモ)と書いた更新 */
let memos: Map<string, string | null>;
let transactions = 0;
const updates: { memo: string }[] = [];

const tx = {
  select: () => ({
    from: () => ({
      where: () => ({
        for: async () => [...memos].map(([id, adminMemo]) => ({ id, adminMemo })),
      }),
    }),
  }),
  update: () => ({
    set: (patch: { admin_memo: string }) => ({
      where: async () => {
        updates.push({ memo: patch.admin_memo });
      },
    }),
  }),
};
const fakeDb = {
  transaction: async (run: (executor: typeof tx) => Promise<unknown>) => {
    transactions += 1;
    return run(tx);
  },
};
mock.module("@/lib/drizzle", { namedExports: { db: fakeDb } });

let recordTarget: MessageRecordTarget;
let recipientsOfRows: typeof import("./reviews").recipientsOfRows;
before(async () => {
  ({ recordTarget, recipientsOfRows } = await import("./reviews"));
});
beforeEach(() => {
  memos = new Map([
    ["r1", null],
    ["r2", "前のメモ"],
  ]);
  transactions = 0;
  updates.length = 0;
});

const sent = (channels: string[]): MessageRecordTargetSent => ({
  recordIds: ["r1", "r2"],
  dispatchId: "d1",
  counts: { recipientCount: 1, channelCounts: {}, queuedCount: 0 },
  channels,
  message: "bankTransferReview.transferCheck",
  fields: { subject: "お振込に関するお知らせ", body: "本文" },
});

test("送れる連絡定義は transferCheck", () => {
  assert.deepEqual(recordTarget.messages, ["bankTransferReview.transferCheck"]);
});

test("宛先: 1 人 1 件にまとめ、宛名・金額・申告日を「、」でつなぐ(名前が無ければお客様)", () => {
  const at = (day: number) => new Date(Date.UTC(2026, 10, day, 3));
  const recipients = recipientsOfRows([
    { id: "r1", userId: "u1", submittedAt: at(1), paymentAmount: 1000, userName: "山田" },
    { id: "r2", userId: "u2", submittedAt: at(2), paymentAmount: 500, userName: null },
    { id: "r3", userId: "u1", submittedAt: at(3), paymentAmount: 2000, userName: "山田" },
  ]);
  assert.deepEqual(recipients, [
    {
      userId: "u1",
      recordIds: ["r1", "r3"],
      vars: { displayName: "山田", paymentAmounts: "¥1,000、¥2,000", submittedDates: "2026/11/01、2026/11/03" },
    },
    { userId: "u2", recordIds: ["r2"], vars: { displayName: "お客様", paymentAmounts: "¥500", submittedDates: "2026/11/02" } },
  ]);
});

test("afterSend: inApp だけの送信はメモを書かない(D196)", async () => {
  await recordTarget.afterSend!(sent(["inApp"]));
  assert.equal(transactions, 0);
  assert.deepEqual(updates, []);
});

test("afterSend: email を含む送信は審査ごとに「メール送付」のメモを足す", async () => {
  await recordTarget.afterSend!(sent(["email", "inApp"]));
  assert.equal(transactions, 1);
  assert.equal(updates.length, 2);
  assert.match(updates[0]!.memo, /^\d{4}\/\d{2}\/\d{2}「お振込に関するお知らせ」メール送付$/);
  assert.match(updates[1]!.memo, /^前のメモ\n\d{4}\/\d{2}\/\d{2}「お振込に関するお知らせ」メール送付$/);
});
