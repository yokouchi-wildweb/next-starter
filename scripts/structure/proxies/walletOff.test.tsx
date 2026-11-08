// scripts/structure/proxies/walletOff.test.tsx
// wallet と payment を閉じたとき、core を編集せずにウォレット・購入まわりが何も動かないこと(L1.15、routed 20261105-070903-wallet-purchase-pluggable)。
// 閉じた状態は一覧の規則の enabled を一時的に差し替えて作る(config の値に依らない)。実行: pnpm test scripts/structure/proxies/walletOff.test.tsx
// (a) cron のタスク: 住所が閉じ discover の closedBy が付く(route・pnpm task・vercel.json から外れる)
// (b) 常時実行の拡張点(alwaysOn)の項目: wallet / payment の機能のフォルダを読む項目は enabled() が false
// (c) 管理のサイドバー: wallet / payment の住所の行が無い
// (d) client の枠の値: useGate().enabled("wallet" / "payment") が false(利用者の管理一覧の残高調整などの出し分け)
// (e) 閉じる住所: 画面・汎用 API・自前の API・webhook・cron の住所が gate.path で閉
// coupon の購入割引のカテゴリ: coupon/handlers/init.ts は payment が開のときだけ purchaseRequest の handler を登録する。閉じたら購入割引のカテゴリが無い

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { clientGateState, gate, type FeatureName, type GatedFeatureRule } from "@/featureGate";
import { GateProvider, useGate, type ClientGate } from "@/featureGate/client";
import { configRules, rules } from "@/featureGate/node";

import { adminSidebarHrefs } from "../../../src/featureGate/checks/adminSidebar";
import { folderSourcePattern, gatedImports } from "../../../src/featureGate/checks/alwaysOnEntries.mjs";
import { loadCronTasks } from "../cron/discover";
import { planExtensions } from "../extensions/extensions.mjs";

const ROOT = resolve(import.meta.dirname, "../../..");
const OFF: FeatureName[] = ["wallet", "payment"];

/** 一覧の規則の enabled を差し替えて fn を走らせる(OFF は false、他は true)。規則の値の一覧 configRules(cron の discover が読む)も同じに */
async function withWalletOff<T>(fn: () => T | Promise<T>, off: readonly FeatureName[] = OFF): Promise<T> {
  const saved = new Map<GatedFeatureRule, GatedFeatureRule["enabled"]>();
  for (const rule of [...rules, ...configRules]) {
    saved.set(rule, rule.enabled);
    rule.enabled = () => !off.includes(rule.name);
  }
  try {
    return await fn();
  } finally {
    for (const [rule, enabled] of saved) rule.enabled = enabled;
  }
}

function Probe({ onGate }: { onGate: (gate: ClientGate) => void }) {
  onGate(useGate());
  return null;
}

function adminGate(): ClientGate {
  let captured: ClientGate | undefined;
  renderToStaticMarkup(
    <GateProvider state={clientGateState("admin")}>
      <Probe onGate={(g) => (captured = g)} />
    </GateProvider>,
  );
  assert.ok(captured);
  return captured;
}

const offRules = () => rules.filter((rule) => OFF.includes(rule.name));
const offFolders = () => offRules().flatMap((rule) => rule.features ?? []);

test("(a) cron: wallet / payment のタスクは住所が閉じ、discover の closedBy が付く", async () => {
  const tasks = await withWalletOff(() => loadCronTasks(ROOT));
  const closed = tasks.filter((task) => task.closedBy !== null).map((task) => `${task.name}:${task.closedBy}`).sort();
  assert.deepEqual(closed, [
    "expire-pending-purchases:payment",
    "wallet-expiration-notice:wallet",
    "wallet-expire-lots:wallet",
    "wallet-lots-prune:wallet",
  ]);
  const open = await withWalletOff(() => loadCronTasks(ROOT), []);
  assert.ok(open.every((task) => task.closedBy === null));
});

test("(b) 常時実行の拡張点: wallet / payment のフォルダを読む項目は enabled() が false(開けば true)", async () => {
  type Point = { spec: { alwaysOn?: boolean; export: string } };
  const plan = planExtensions(ROOT) as unknown as { points: Point[]; itemsByPoint: Map<Point, { itemFile: string }[]> };
  const patterns = offFolders().map(folderSourcePattern);
  const items = plan.points
    .filter((point) => point.spec.alwaysOn)
    .flatMap((point) => (plan.itemsByPoint.get(point) ?? []).map((item) => ({ file: item.itemFile, exportName: point.spec.export })))
    .filter((item) => gatedImports(readFileSync(join(ROOT, item.file), "utf8"), patterns).length > 0);
  const files = items.map((item) => item.file);
  for (const expected of [
    "src/features/core/batchJob/jobHandlers/walletBulkAdjust.ts",
    "src/features/core/user/cleanupHandlers/wallet.ts",
    "src/features/core/user/cleanupHandlers/purchaseRequest.ts",
  ]) assert.ok(files.includes(expected), `${expected} が常時の項目の走査に入らない(走査を確認)`);
  // 規則の enabled と同じ config の式を直に読む項目(gate を通らない。L1.10: 設定の議会の指令 03 が gate に直す)。
  // 本物の config では規則と同じ値で閉じるので、式が同じことだけ確かめて既知として出す
  const ruleEnabledSource = (name: string) => /\benabled\s*:\s*([^\n]*?),?\s*$/m.exec(readFileSync(join(ROOT, "src/featureGate/rules", `${name}.ts`), "utf8"))?.[1]?.trim() ?? "";
  const sameExpression = (text: string) => offRules().map((rule) => ruleEnabledSource(rule.name)).find((expr) => expr.length > 0 && text.includes(`enabled: ${expr}`));
  for (const item of items) {
    const mod = (await import(pathToFileURL(join(ROOT, item.file)).href)) as Record<string, { enabled?: () => boolean }>;
    const value = mod[item.exportName];
    assert.equal(typeof value?.enabled, "function", `${item.file}: enabled が無い`);
    assert.equal(await withWalletOff(() => value.enabled!(), []), true, `${item.file}: 開いても enabled() が false`);
    if (await withWalletOff(() => value.enabled!())) {
      const expr = sameExpression(readFileSync(join(ROOT, item.file), "utf8"));
      assert.ok(expr, `${item.file}: 閉じても enabled() が true(規則と同じ config の式でもない)`);
      console.log(`[wallet-off] 既知: ${item.file} は gate を通らず規則と同じ式 ${expr} を読む(本物の config では一緒に閉じる。L1.10 設定の議会の指令 03 が gate に直す)`);
    }
  }
});

test("(c)(d) 管理のサイドバーに wallet / payment の住所の行が無く、client の枠の値も閉", async () => {
  const sidebarHrefs = () => adminSidebarHrefs();
  const openHrefs = await withWalletOff(sidebarHrefs, []);
  const offHrefs = await withWalletOff(sidebarHrefs);
  const removed = openHrefs.filter((href) => !offHrefs.includes(href));
  assert.ok(removed.length > 0, "wallet / payment を閉じても消える行が無い(メニューの確認)");
  await withWalletOff(() => {
    // 消えた行は閉じた住所、残った行は開いた住所
    for (const href of removed) assert.equal(gate.path(href.split(/[?#]/)[0]).open, false, `閉じていないのに消えた: ${href}`);
    for (const href of offHrefs) assert.equal(gate.path(href.split(/[?#]/)[0]).open, true, `閉じた住所の行が残る: ${href}`);
    const client = adminGate();
    assert.equal(client.enabled("wallet"), false);
    assert.equal(client.enabled("payment"), false);
  });
});

test("(e) 閉じる住所: 画面・汎用 API・自前の API・webhook・cron", async () => {
  const paths = [
    "/wallet",
    "/api/wallet",
    "/api/walletHistory",
    "/api/me/wallet",
    "/api/admin/wallet",
    "/api/purchaseRequest",
    "/api/bankTransferReview",
    "/api/wallet/purchase",
    "/api/webhook/payment",
    "/admin/bank-transfer-reviews",
    "/api/cron/wallet-expire-lots",
    "/api/cron/expire-pending-purchases",
  ];
  await withWalletOff(() => {
    for (const path of paths) assert.equal(gate.path(path).open, false, path);
  });
  await withWalletOff(() => {
    for (const path of paths) assert.equal(gate.path(path).open, true, path);
  }, []);
});

test("coupon の購入割引のカテゴリ: payment を閉じると登録されない", async () => {
  await withWalletOff(async () => {
    await import("@/features/core/coupon/handlers/init");
    const { getRegisteredCategories } = await import("@/features/core/coupon/handlers");
    const { PURCHASE_DISCOUNT_CATEGORY } = await import("@/features/core/purchaseRequest/types/couponEffect");
    assert.ok(!getRegisteredCategories().includes(PURCHASE_DISCOUNT_CATEGORY));
  });
});
