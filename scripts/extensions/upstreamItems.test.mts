// scripts/extensions/upstreamItems.test.mts
// 拡張点へ移した上流の項目が、何も足さない状態で今までどおり動くことの回帰テスト(DB は使わない)。
// - 退会の後片付け: 必須 → 任意の順、必須の失敗は投げる、任意の失敗は続行、enabled false は走らない。上流の項目の組
// - コイン創出のソース: enabled false は外す。上流の項目の組(一覧の順 = ファイル名の順)
// - 読み込み: 項目と読み手が互いを読み合っても、どの入口から読んでも壊れない(入口ごとに別プロセス)
// 実行: pnpm test:extension-items

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { onDemoUserCreated } from "@/features/core/auth/services/server/onDemoUserCreated";
import { getCouponIssuerProgram, isCouponIssuerProgramEnabled } from "@/features/core/couponIssuerGrant/services/server/program";
import { getPaymentSessionEnricher } from "@/features/core/purchaseRequest/services/server/payment/getSessionEnricher";
import { getAllCoinIssuanceLabels, getCoinIssuanceLabel } from "@/features/core/analytics/services/server/coinIssuance/labels";
import { formatActionLabel } from "@/features/core/auditLog/presenters";
import { buildCouponAdminSectionTabs } from "@/features/core/coupon/lib/adminSectionTabs";
import { activeCoinIssuanceSources } from "@/features/core/analytics/services/server/coinIssuance/activeSources";
import type { CoinIssuanceSource } from "@/features/core/analytics/services/server/coinIssuance/types";
import { runCleanupItems } from "@/features/core/user/services/server/cleanup";

import { webhookHandlers } from "@/features/core/userLineProfile/extensions/webhookHandlers";
import { dispatchWebhookEvents } from "@/features/core/userLineProfile/services/server/dispatchWebhookEvents";

import { categories } from "@/app/_layout/adminCommand/extensions/categories";
import { plugins } from "@/app/_layout/adminCommand/extensions/plugins";
import { DEMO_CATEGORIES, groupDemoPagesByCategory, openDemoPages } from "@/app/(user)/demo/_data/demoPages";
import { demoPages } from "@/app/(user)/demo/extensions/demoPages";
import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";
import { CHAT_ATTACHMENT_CONTENT_TYPES } from "@/config/app/chat-attachment.config";
import { loadForAdmin } from "@/features/core/adminCommand/base/loadForAdmin";
import { navigationItems } from "@/features/core/adminCommand/definitions/navigation/items";
import { validateChatFile } from "@/features/core/chatRoom/utils/validation";
import { renderers } from "@/features/core/milestone/extensions/renderers";
import { buildStrategyMap } from "@/features/core/purchaseRequest/services/server/completion/strategyRegistry";
import { buildRewardHandlerMap } from "@/features/core/referralReward/services/server/rewardHandlerRegistry";
import { buildBody, buildTitle } from "@/features/core/wallet/services/server/notification/adjustmentNotificationTemplate";
import { seoConfig } from "@/config/seo.config";
import { readDeclaredForkIds } from "../../src/lib/forkOwnership/forkIds.mjs";
import { assertNoCronOverlap, listOneShotTasks, loadOneShotTask } from "../tasks/discover";
import { itemsOf, planExtensions } from "./extensions.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const tx = {} as never;

test("後片付け: 必須 → 任意の順、無効は走らない、任意の失敗は続行", async () => {
  const log: string[] = [];
  const item = (name: string, required: boolean, enabled?: () => boolean, fail = false) => ({
    required,
    enabled,
    run: async () => {
      log.push(name);
      if (fail) throw new Error(name);
    },
  });
  const originalError = console.error;
  console.error = () => {};
  try {
    await runCleanupItems(
      [item("optA", false, undefined, true), item("reqOff", true, () => false), item("req", true), item("optB", false), item("optOff", false, () => false)],
      "u1",
      tx,
    );
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(log, ["req", "optA", "optB"]);
});

test("後片付け: 必須の失敗はそのまま投げ、後の項目は走らない(トランザクションのロールバック)", async () => {
  const log: string[] = [];
  await assert.rejects(
    runCleanupItems(
      [
        { required: true, run: async () => { throw new Error("boom"); } },
        { required: false, run: async () => { log.push("opt"); } },
      ],
      "u1",
      tx,
    ),
    /boom/,
  );
  assert.deepEqual(log, []);
});

test("コイン創出: enabled false のソースは外し、省略は常に入る", () => {
  const source = (key: string, enabled?: () => boolean) => ({ key, kind: "issuance", enabled, aggregate: async () => ({}) }) as unknown as CoinIssuanceSource;
  assert.deepEqual(activeCoinIssuanceSources([source("a"), source("b", () => false), source("c", () => true)]).map((s) => s.key), ["a", "c"]);
});

test("上流の項目の組: 宣言と受け口がそろい、機能に閉じる項目は enabled を持つ", () => {
  const plan = planExtensions(ROOT);
  assert.deepEqual(plan.problems, [], plan.problems.join("\n"));
  const names = (owner: string, point: string) => itemsOf(plan, owner, point).map((i: { name: string }) => i.name);
  assert.deepEqual(names("src/features/core/user", "cleanupHandlers"), ["purchaseRequest", "wallet"]);
  assert.deepEqual(names("src/features/core/analytics", "coinIssuanceSources"), ["couponAttributionReward", "purchaseBonusGap", "referralReward"]);
  assert.deepEqual(names("src/features/core/analytics", "rollupMetrics"), []);
  assert.deepEqual(names("src/features/core/user", "reservedNames"), []);
  assert.deepEqual(names("src/features/core/purchaseRequest", "completionStrategies"), ["walletTopup"]);
  assert.deepEqual(names("src/features/core/batchJob", "jobHandlers"), ["walletBulkAdjust"]);
});

test("1 行スイッチの既定: 何も足さない状態で今までと同じ(エンリッチャーなし・プログラムなし・フックは何もしない)", async () => {
  assert.equal(getPaymentSessionEnricher(), null);
  assert.equal(getCouponIssuerProgram(), null);
  assert.equal(isCouponIssuerProgramEnabled(), false);
  assert.equal(await onDemoUserCreated("u1"), undefined);
  const plan = planExtensions(ROOT);
  assert.deepEqual(plan.switches.map((s: { target: string }) => s.target).sort(), ["RateLimitWarningContent.default", "adjustmentNotificationTemplate.default", "onDemoUserCreated.default", "programConfig.default", "sessionEnricher.default"]);
});

test("config へ移した値の読み手: 既定の表示と未定義のときのフォールバックは今までと同じ", () => {
  assert.equal(getCoinIssuanceLabel("purchase_bonus_gap"), "購入時ボーナス発行");
  assert.equal(getCoinIssuanceLabel("unknown_key"), "unknown_key");
  assert.deepEqual(Object.keys(getAllCoinIssuanceLabels()).sort(), ["coupon_attribution_reward", "purchase_bonus_gap", "referral_reward"]);
  assert.equal(formatActionLabel("wallet.balance.cleared"), "残高クリア");
  assert.equal(formatActionLabel("unknown.action.done"), "unknown.action.done");
  assert.deepEqual(buildCouponAdminSectionTabs().map((tab) => tab.value), ["official", "affiliate", "invite"]);
});

const ENTRIES = [
  ["src/features/core/purchaseRequest/services/server/completion/index.ts", "getPurchaseCompletionStrategy", "wallet_topup"],
  ["src/features/core/purchaseRequest/services/server/completion/strategies/walletTopup.ts", null, null],
  ["src/features/core/purchaseRequest/services/server/wrappers/purchaseService.ts", null, null],
  ["src/features/core/batchJob/services/server/index.ts", "getHandler", "wallet_bulk_adjust"],
  ["src/features/core/batchJob/jobHandlers/walletBulkAdjust.ts", null, null],
  ["src/features/core/wallet/services/server/handlers/walletBulkAdjustHandler.ts", null, null],
  ["src/features/core/wallet/services/server/walletService.ts", null, null],
  ["src/features/core/milestone/services/server/wrappers/evaluateMilestones.ts", null, null],
  ["src/features/core/referralReward/services/server/referralRewardService.ts", null, null],
] as const;

for (const [entry, fn, arg] of ENTRIES) {
  test(`読み込み: ${entry} から読んでも壊れない${fn ? `、${fn}("${arg}") が引ける` : ""}`, () => {
    const code = `const m = await import(${JSON.stringify(`${ROOT}/${entry}`)});${fn ? `const r = m.${fn}(${JSON.stringify(arg)}); if (!r) throw new Error("not found");` : ""}process.exit(0);`;
    const result = spawnSync("npx", ["tsx", "--import", "./scripts/test/serverOnlyStub.mjs", "--input-type=module", "-e", code], { cwd: ROOT, encoding: "utf8", env: { ...process.env, DATABASE_URL: "" } });
    assert.equal(result.status, 0, result.stderr.slice(-1500));
  });
}

test("LINE Webhook: 一致する項目を順に全部呼ぶ、失敗は続行、上流の項目は 0", async () => {
  const log: string[] = [];
  const item = (name: string, eventType: string, fail = false) => ({
    eventType,
    handle: async () => {
      log.push(name);
      if (fail) throw new Error(name);
    },
  });
  const originalError = console.error;
  console.error = () => {};
  try {
    const events = [{ type: "follow" }, { type: "unknown" }, { type: "message" }] as never[];
    await dispatchWebhookEvents(events, [item("a", "follow", true), item("b", "follow"), item("c", "message")]);
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(log, ["a", "b", "c"]);
  assert.deepEqual(webhookHandlers, []);
});

test("タスクの走査: 上流の 7 本、名前の一致と読み込み", async () => {
  const tasks = listOneShotTasks(ROOT, readDeclaredForkIds(ROOT).all);
  assert.deepEqual(tasks.map((t) => t.name), [
    "analytics-rollup-backfill",
    "paired-device-pair",
    "purchase-quota-cleanup",
    "user-name-dedup",
    "user-status-history-backfill",
    "wallet-lots-init",
    "wallet-lots-init-from-history",
  ]);
  for (const file of tasks) assert.equal((await loadOneShotTask(ROOT, file)).name, file.name);
});

test("タスクの走査: fork の項目、失敗の形", () => {
  const root = mkdtempSync(join(tmpdir(), "tasks-"));
  const dir = join(root, "scripts/tasks");
  mkdirSync(join(dir, "_shared"), { recursive: true });
  const put = (name: string) => writeFileSync(join(dir, name), "export const task = {};\n");
  try {
    for (const name of ["run.ts", "discover.ts", "types.ts", "a-b.ts", "c.acme.ts", "d.test.ts", "_shared/x.ts", "notes.md"]) put(name);
    assert.deepEqual(listOneShotTasks(root, ["acme"]).map((t) => t.name), ["a-b", "c"]);
    assert.throws(() => assertNoCronOverlap(listOneShotTasks(root, ["acme"]), ["c"]), /src\/app\/api\/cron/);
    assert.throws(() => listOneShotTasks(root, []), /宣言されていない/);
    put("a-b.acme.ts");
    assert.throws(() => listOneShotTasks(root, ["acme"]), /両方にあります/);
    rmSync(join(dir, "a-b.acme.ts"));
    put("Bad_name.ts");
    assert.throws(() => listOneShotTasks(root, ["acme"]), /ファイル名/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("メール: テンプレートは送る側のドメインの mail/ にある", () => {
  for (const path of ["auth/mail/VerificationEmail.tsx", "user/mail/RegistrationCompleteEmail.tsx", "messaging/mail/AdminAnnouncementEmail.tsx"]) {
    assert.equal(existsSync(join(ROOT, "src/features/core", path)), true, path);
  }
});

test("管理者コマンド: 非管理者は読み込まない、管理者は上流の 3 カテゴリを今の順で、プラグイン 0", async () => {
  let calls = 0;
  const spy = [{ name: "x", load: async () => { calls += 1; return {} as never; } }];
  assert.equal(await loadForAdmin(false, { categories: spy, plugins: spy }), null);
  assert.equal(calls, 0);
  assert.deepEqual(categories.map((c) => c.name), ["navigation", "settings", "userSession"]);
  assert.deepEqual(plugins, []);
  assert.deepEqual(navigationItems.map((i) => i.id), ["nav-admin-home", "nav-admin-users-general", "nav-admin-settings", "nav-admin-insane"]);
});

test("デモ: カテゴリ分けと項目の集合が移設前と同じ、カテゴリの中はフォルダ名の順、閉じたデモは除く", () => {
  const expected = {
    form: ["field-layout", "form-components", "media-input"],
    overlay: ["async-picker-modal", "overlay", "popover"],
    ui: ["block-appearance", "fade-slider", "scroll-slider", "sortable-list", "status-badge", "tables"],
    media: ["seamless-av", "seamless-video"],
    auth: ["fingerprint", "google-popup", "google-redirect"],
    payment: ["bank-transfer-vision", "dummy-payment"],
    dev: ["check-env"],
  };
  const groups = groupDemoPagesByCategory(demoPages);
  assert.deepEqual(Object.fromEntries(groups.map((g) => [g.key, g.pages.map((p) => p.folder)])), expected);
  assert.deepEqual(groups.map((g) => g.key), DEMO_CATEGORIES.map((c) => c.key));
  const open = openDemoPages(demoPages, [{ enabled: () => false, pathPatterns: ["/demo/tables"] }, { enabled: () => true, pathPatterns: ["/demo/popover"] }]);
  assert.equal(open.length, demoPages.length - 1);
  assert.equal(open.some((p) => p.folder === "tables"), false);
});

test("マイルストーンのレンダラー: 上流の項目は 0", () => {
  assert.deepEqual(Object.keys(renderers), []);
  assert.equal(renderers["constructor"], undefined);
});

test("チャット添付: 既定の許可種別、種別が空は通す、サイズ上限は今までどおり", () => {
  const file = (type: string, size = 1) => ({ type, size }) as File;
  assert.equal(validateChatFile(file("image/png"), "image").valid, true);
  assert.equal(validateChatFile(file("video/mp4"), "image").valid, false);
  assert.equal(validateChatFile(file("video/mp4"), "video").valid, true);
  assert.equal(validateChatFile(file("application/pdf"), "file").valid, true);
  assert.equal(validateChatFile(file(""), "file").valid, true);
  assert.equal(validateChatFile(file("image/png", 1024 ** 3), "image").valid, false);
  assert.deepEqual(CHAT_ATTACHMENT_CONTENT_TYPES.image, ["image/*"]);
});

test("同じ鍵: コイン創出ソースと管理者コマンドは例外", async () => {
  const source = { key: "a", aggregate: async () => ({ current: 0, previous: 0 }) } as unknown as CoinIssuanceSource;
  assert.throws(() => activeCoinIssuanceSources([source, source]), /複数あります/);
  const item = { name: "x", load: async () => ({ id: "same" }) as never };
  await assert.rejects(loadForAdmin(true, { categories: [item, item], plugins: [] }), /複数あります/);
});

test("同じ鍵: 購入完了の strategy と紹介報酬の rewardHandler は例外、違う鍵は通る", () => {
  const strategy = (type: string) => ({ type }) as never;
  assert.equal(buildStrategyMap([strategy("a"), strategy("b")]).size, 2);
  assert.throws(() => buildStrategyMap([strategy("a"), strategy("a")]), /複数あります/);
  const handler = (rewardKey: string) => ({ rewardKey, handler: async () => ({}) });
  assert.equal(buildRewardHandlerMap([handler("a"), handler("b")]).size, 2);
  assert.throws(() => buildRewardHandlerMap([handler("a"), handler("a")]), /複数あります/);
});

test("残高調整の通知: 既定の組み立ては今までと同じ形", () => {
  const walletType = Object.keys(CURRENCY_CONFIG)[0] as WalletType;
  const { label, unit } = CURRENCY_CONFIG[walletType];
  const params = { walletType, changeMethod: "INCREMENT", amount: 1000, balanceBefore: 0, balanceAfter: 1000, reason: "r" };
  assert.ok(buildTitle(params).startsWith(label));
  const lines = buildBody(params).split("\n");
  assert.equal(lines.length, 4);
  assert.ok(lines[1].endsWith(`+1,000 ${unit}`));
  assert.ok(lines[3].endsWith(": r"));
});

test("root の lang・viewport: 既定は今までと同じ、layout は config を読む", () => {
  assert.equal(seoConfig.htmlLang, "en");
  assert.deepEqual(seoConfig.viewport, { width: "device-width", initialScale: 1 });
  const layout = readFileSync(join(ROOT, "src/app/layout.tsx"), "utf8");
  assert.match(layout, /lang=\{seoConfig\.htmlLang\}/);
  assert.match(layout, /export const viewport: Viewport = seoConfig\.viewport;/);
});
