// 区切り expiry-move の道具(旧 cron の task.override の disabled → 項目の上書き enabled: false)のテスト。
// - wallet-lots-prune を disabled で止めている(boardgame-site の形)→ walletLotsPrune.override.ts を書く、書いた後は済み(2 回目は何も書かない)
// - 個人情報の項目の旧 cron を止めている → その回は何も書かず問いで止める(ほかの書く物も書かない)
// - schedule だけ → 知らせだけ。字面でない cronOverride・既にある違う形の上書き → 止める
// 実行: pnpm test .notices/20261125-033721-expiry-move.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import { itemOverridePath, itemOverrideText, MOVES, planMoves, readExportedObject } from "./20261125-033721-expiry-move.mjs";

// boardgame-site の src/app/api/cron/wallet-lots-prune/task.override.ts の形
const BOARDGAME_WALLET = `// src/app/api/cron/wallet-lots-prune/override.ts
// このプロジェクトでは定期実行しない（決済・ウォレットを使わない。project.md payment_not_used）

import type { CronTaskOverride } from "@/lib/cron";

export const cronOverride: CronTaskOverride = {
  disabled: true,
};
`;

const reader = (files) => (path) => (Object.hasOwn(files, path) ? files[path] : null);
const wallet = MOVES.find((move) => move.cron === "wallet-lots-prune");

test("旧 cron の上書きが無い: 書く物なし", () => {
  assert.deepEqual(planMoves(reader({})), { ok: true, write: [], done: [], notes: [] });
});

test("wallet-lots-prune を disabled で止めている: 項目の上書きを書き、書いた後は済み", () => {
  const files = { "src/app/api/cron/wallet-lots-prune/task.override.ts": BOARDGAME_WALLET };
  const plan = planMoves(reader(files));
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.write.map((move) => itemOverridePath(move)), ["src/domains/core/wallet/plugs/expiryRules/walletLotsPrune.override.ts"]);
  const text = itemOverrideText(wallet);
  assert.deepEqual(readExportedObject(text, "override", "x").values, { enabled: false });
  assert.match(text, /import type \{ ExpiryRule \} from "@\/lib\/cron\/points";/);
  const again = planMoves(reader({ ...files, [itemOverridePath(wallet)]: text }));
  assert.deepEqual(again, { ok: true, write: [], done: [wallet], notes: [] });
});

test("個人情報の項目の旧 cron を止めている: 何も書かず問いで止める(ほかの書く物も書かない)", () => {
  const plan = planMoves(
    reader({
      "src/app/api/cron/wallet-lots-prune/task.override.ts": BOARDGAME_WALLET,
      "src/app/api/cron/audit-log-prune/task.override.ts": "export const cronOverride = { disabled: true };\n",
    }),
  );
  assert.equal(plan.ok, false);
  assert.equal(plan.stops.length, 1);
  assert.match(plan.stops[0], /audit-log-prune .*auditLog\/auditLogPrune .*pii: true.*upstream へ \/order.*task\.override\.ts を消す/);
  assert.equal(plan.write, undefined);
});

test("schedule だけ: 知らせだけで書かない。disabled: false も書かない", () => {
  const plan = planMoves(
    reader({
      "src/app/api/cron/user-login-event-prune/task.override.ts": 'export const cronOverride = { schedule: "0 20 * * *" } satisfies CronTaskOverride;\n',
      "src/app/api/cron/paired-device-pairings-prune/task.override.ts": "export const cronOverride = { disabled: false };\n",
    }),
  );
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.write, []);
  assert.equal(plan.notes.length, 1);
  assert.match(plan.notes[0], /user-login-event-prune: schedule は旧 cron が区切り expiry-retire-crons で消えると効かなくなる/);
});

test("止める: 字面でない cronOverride、既にある違う形の上書き", () => {
  const computed = planMoves(reader({ "src/app/api/cron/wallet-lots-prune/task.override.ts": "export const cronOverride = { disabled: isOff() };\n" }));
  assert.equal(computed.ok, false);
  assert.match(computed.stops[0], /disabled の値が字面でない/);
  const spread = planMoves(reader({ "src/app/api/cron/wallet-lots-prune/task.override.ts": "export const cronOverride = { ...base };\n" }));
  assert.equal(spread.ok, false);
  const other = planMoves(
    reader({
      "src/app/api/cron/wallet-lots-prune/task.override.ts": BOARDGAME_WALLET,
      [itemOverridePath(wallet)]: "export const override = { batchSize: 200 };\n",
    }),
  );
  assert.equal(other.ok, false);
  assert.match(other.stops[0], /enabled: false だけの形でない.*batchSize/);
});

test("表: 8 本、個人情報でないのは wallet-lots-prune と paired-device-pairings-prune だけ", () => {
  assert.equal(MOVES.length, 8);
  assert.deepEqual(MOVES.filter((move) => !move.pii).map((move) => move.cron), ["wallet-lots-prune", "paired-device-pairings-prune"]);
});
