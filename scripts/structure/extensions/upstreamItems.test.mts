// scripts/structure/extensions/upstreamItems.test.mts
// 拡張点へ移した上流の項目が、何も足さない状態で今までどおり動くことの回帰テスト(DB は使わない)。
// - 退会の後片付け: 必須 → 任意の順、必須の失敗は投げる、任意の失敗は続行、enabled false は走らない。上流の項目の組
// - コイン創出のソース: enabled false は外す。上流の項目の組(一覧の順 = ファイル名の順)
// - 読み込み: 項目と読み手が互いを読み合っても、どの入口から読んでも壊れない(入口ごとに別プロセス)
// fork でも走る: 動きの検査は全 Tier、上流の項目の組と既定の値の厳密な比較は Tier1 だけ(fork は項目を足し、config を書き換え、スイッチの向きを変え、機能を閉じる)
// 実行: pnpm test scripts/structure/extensions/upstreamItems.test.mts

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { onDemoUserCreated } from "@/domains/core/demo/services/server/onDemoUserCreated";
import { getCouponIssuerProgram, isCouponIssuerProgramEnabled } from "@/domains/core/couponIssuerGrant/services/server/program";
import { getPaymentSessionEnricher } from "@/domains/core/purchaseRequest/services/server/payment/getSessionEnricher";
import { getAllCoinIssuanceLabels, getCoinIssuanceLabel } from "@/domains/core/analytics/services/server/coinIssuance/labels";
import { formatActionLabel } from "@/domains/core/auditLog/presenters";
import { buildCouponAdminSectionTabs } from "@/domains/core/coupon/lib/adminSectionTabs";
import { activeCoinIssuanceSources } from "@/domains/core/analytics/services/server/coinIssuance/activeSources";
import type { CoinIssuanceSource } from "@/domains/core/analytics/services/server/coinIssuance/types";
import { runCleanupItems } from "@/domains/core/user/services/server/cleanup";

import { userLineProfileWebhookHandlers } from "@/domains/core/userLineProfile/extensions/userLineProfileWebhookHandlers";
import { dispatchWebhookEvents } from "@/domains/core/userLineProfile/services/server/dispatchWebhookEvents";

import { adminCommandCategories as categories } from "@/domains/core/adminCommand/extensions/adminCommandCategories";
import { adminCommandPlugins as plugins } from "@/domains/core/adminCommand/extensions/adminCommandPlugins";
import { DEMO_CATEGORIES, groupDemoPagesByCategory, openDemoPages } from "@/app/(user)/demo/_data/demoPages";
import { demoPages } from "@/app/(user)/demo/extensions/demoPages";
import { chatRoomConfig } from "@/domains/chatRoom/config";
import { loadForAdmin } from "@/domains/core/adminCommand/base/loadForAdmin";
import { adminCommandNavigationItems } from "@/domains/core/adminCommand/extensions/adminCommandNavigationItems";
import { validateChatFile } from "@/domains/core/chatRoom/utils/validation";
import { milestoneRenderers } from "@/domains/core/milestone/extensions/milestoneRenderers";
import { buildStrategyMap } from "@/domains/core/purchaseRequest/services/server/completion/strategyRegistry";
import { buildRewardHandlerMap } from "@/domains/core/referralReward/services/server/rewardHandlerRegistry";
import { ROOT_LAYOUT_CONFIG } from "@/app/_layout/config";
import { EXAMPLE_BUSINESS } from "@/lib/business";
import { messageRegistry } from "@/registry/messageRegistry";
import { messagingLayouts } from "@/domains/core/messaging/extensions/messagingLayouts";
import { configEnabled } from "@/featureGate/node";
import { readForkIdentity } from "@/lib/forkOwnership/node.mjs";
import { listOneShotTasks, loadOneShotTask } from "../../runner/task/discover";
import { itemsOf, planExtensions } from "./extensions.mjs";

const ROOT = resolve(import.meta.dirname, "../../..");
const tx = {} as never;
const { isTier1 } = readForkIdentity(ROOT);
/** 上流の既定の値の検査(fork では飛ばす) */
const tier1Only = { skip: isTier1 ? false : "上流の既定の値の検査(Tier1 だけ)" };
/** Tier1 は完全一致、fork は上流の項目を含むこと */
const assertUpstreamItems = (actual: readonly string[], upstream: readonly string[]) => {
  if (isTier1) assert.deepEqual([...actual], [...upstream]);
  else for (const item of upstream) assert.ok(actual.includes(item), `上流の項目 ${item} が無い`);
};

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
  assertUpstreamItems(names("src/domains/core/user", "userCleanupHandlers"), ["messagingEndpoints", "messagingPreferences", "purchaseRequest", "wallet"]);
  assertUpstreamItems(names("src/domains/core/analytics", "analyticsCoinIssuanceSources"), ["purchaseBonusGap", "walletBonusGrant"]);
  assertUpstreamItems(names("src/domains/core/analytics", "analyticsRollupMetrics"), [
    "messagingBounced", "messagingClicked", "messagingComplained", "messagingDelivered", "messagingFailed", "messagingOpened",
    "messagingRead", "messagingSent", "messagingSuppressed", "messagingTargeted", "messagingUnsubscribed",
  ]);
  assertUpstreamItems(names("src/domains/core/analytics", "analyticsExclusionProviders"), []);
  assertUpstreamItems(names("src/domains/core/walletHistory", "walletHistoryReasonKeys"), ["couponAttributionReward", "adminAdjustment", "compensation"]);
  assertUpstreamItems(names("src/domains/core/user", "userReservedNames"), []);
  assertUpstreamItems(names("src/domains/core/purchaseRequest", "purchaseRequestCompletionStrategies"), ["walletTopup"]);
  assertUpstreamItems(names("src/domains/core/batchJob", "batchJobJobHandlers"), ["walletBulkAdjust"]);
  assertUpstreamItems(names("src/domains/core/messaging", "messagingEnrichers"), ["displayName"]);
});

test("1 行スイッチの既定: 何も足さない状態で今までと同じ(エンリッチャーなし・プログラムなし・フックは何もしない)", tier1Only, async () => {
  assert.equal(getPaymentSessionEnricher(), null);
  assert.equal(getCouponIssuerProgram(), null);
  assert.equal(isCouponIssuerProgramEnabled(), false);
  assert.equal(await onDemoUserCreated("u1"), undefined);
  const plan = planExtensions(ROOT);
  // 上流のスイッチは全部 .default を指す(今と同じ振る舞い)。AdminHeader.default は管理のヘッダーの行の既定の部品
  // (src/app/admin/_layout、指令 17 d2): AdminPage が描く行そのもので、fork の差し替えの口は隣の AdminHeader.replace(1 行スイッチ)。ちょうど 1 つの点の上流の項目(auth の routeFactoryUser・proxyUser・frameSession・pageGuardUser の session.default、rateLimit の ipRate.default)は差す側の plugs/<点>/ の 1 行スイッチ(地区の段 3、D53。ForkProviders は rootProviders に畳んだ)
  // MailFrame.default は全メールの枠(src/lib/mail/frame、指令 54 D122: fork は MailFrame.replace で一度に替える)
  // NoticeEmail.default・NoticeInApp.default は上流のレイアウト「汎用」の見た目(messaging/plugs/messagingLayouts/notice、指令 54 d5)
  // Link・Welcome・Statement・Alert の Email / InApp.default は上流のレイアウト「認証のリンク」「ようこそ」「明細」「セキュリティの警告」の見た目(指令 55 d4)
  // SimpleEmail.default・SimpleInApp.default は上流のレイアウト「シンプル」の見た目(messaging/plugs/messagingLayouts/simple、D119)
  const targets = plan.switches.map((s: { target: string }) => s.target).sort();
  assert.deepEqual(targets, [
    "AdminHeader.default",
    "AlertEmail.default",
    "AlertInApp.default",
    "LinkEmail.default",
    "LinkInApp.default",
    "MailFrame.default",
    "NoticeEmail.default",
    "NoticeInApp.default",
    "RateLimitWarningContent.default",
    "SimpleEmail.default",
    "SimpleInApp.default",
    "StatementEmail.default",
    "StatementInApp.default",
    "WelcomeEmail.default",
    "WelcomeInApp.default",
    "ipRate.default",
    "onDemoUserCreated.default",
    "programConfig.default",
    "session.default",
    "session.default",
    "session.default",
    "session.default",
    "sessionEnricher.default",
  ]);
});

test("config へ移した値の読み手: 既定の表示と未定義のときのフォールバックは今までと同じ", tier1Only, () => {
  assert.equal(getCoinIssuanceLabel("purchase_bonus_gap"), "購入時ボーナス発行");
  assert.equal(getCoinIssuanceLabel("unknown_key"), "unknown_key");
  assert.deepEqual(Object.keys(getAllCoinIssuanceLabels()).sort(), ["coupon_attribution_reward", "purchase_bonus_gap", "referral_reward", "wallet_bonus_grant"]);
  assert.equal(formatActionLabel("wallet.balance.cleared"), "残高クリア");
  assert.equal(formatActionLabel("unknown.action.done"), "unknown.action.done");
  assert.deepEqual(buildCouponAdminSectionTabs((items) => [...items]).map((tab) => tab.value), ["official", "affiliate", "invite"]);
});

const ENTRIES = [
  ["src/domains/core/purchaseRequest/services/server/completion/index.ts", "getPurchaseCompletionStrategy", "wallet_topup"],
  ["src/domains/core/wallet/plugs/purchaseRequestCompletionStrategies/walletTopup.ts", null, null],
  ["src/domains/core/purchaseRequest/services/server/wrappers/purchaseService.ts", null, null],
  ["src/domains/core/batchJob/services/server/index.ts", "getHandler", "wallet_bulk_adjust"],
  ["src/domains/core/wallet/plugs/batchJobJobHandlers/walletBulkAdjust.ts", null, null],
  ["src/domains/core/wallet/services/server/handlers/walletBulkAdjustHandler.ts", null, null],
  ["src/domains/core/wallet/services/server/walletService.ts", null, null],
  ["src/domains/core/milestone/services/server/wrappers/evaluateMilestones.ts", null, null],
  ["src/domains/core/referralReward/services/server/referralRewardService.ts", null, null],
] as const;

for (const [entry, rawFn, arg] of ENTRIES) {
  // ジョブのハンドラ・購入完了の戦略(どちらも wallet の plugs の項目)は wallet が閉じている間は門番で外れる(gate.plugs、地区の段 3)
  const fn = (rawFn === "getHandler" || rawFn === "getPurchaseCompletionStrategy") && !configEnabled("wallet") ? null : rawFn;
  test(`読み込み: ${entry} から読んでも壊れない${fn ? `、${fn}("${arg}") が引ける` : ""}`, () => {
    const code = `const m = await import(${JSON.stringify(`${ROOT}/${entry}`)});${fn ? `const r = m.${fn}(${JSON.stringify(arg)}); if (!r) throw new Error("not found");` : ""}process.exit(0);`;
    const result = spawnSync("npx", ["tsx", "--import", "./scripts/runner/preload/serverOnly.mjs", "--input-type=module", "-e", code], { cwd: ROOT, encoding: "utf8", env: { ...process.env, DATABASE_URL: "" } });
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
  if (isTier1) assert.deepEqual(userLineProfileWebhookHandlers, []);
});

test("タスクの走査: 上流のドメインのタスク・移行 16 本、名前の一致と読み込み(置き方の誤りの形は scripts/runner/task/discover.test.ts)", async () => {
  const tasks = listOneShotTasks(ROOT).filter((t) => t.file.startsWith("src/domains/core/"));
  assert.deepEqual(tasks.map((t) => t.name), [
    "analytics:rollup-backfill",
    "messaging:merge-dispatch-vars",
    "messaging:rename-template-vars",
    "outbox:reprocess",
    "pairedDevice:pair",
    "purchaseQuota:cleanup",
    "setting:copy-list-per-page",
    "setting:merge-maintenance-keys",
    "user:bulk-change-status",
    "user:name-dedup",
    "user:status-history-backfill",
    "wallet:bulk-grant",
    "wallet:lots-init",
    "wallet:lots-init-from-history",
    "wallet:reverse-history",
    "walletHistory:reason-key-backfill",
  ]);
  for (const file of tasks) assert.equal((await loadOneShotTask(ROOT, file)).name, file.name);
});

test("システムの連絡: 上流の auth・user の連絡は生成の一覧にあり、レイアウトを持つ", async () => {
  const keys = Object.keys(messageRegistry).filter((key) => key.startsWith("auth.") || key.startsWith("user."));
  assertUpstreamItems(keys, [
    "auth.accountLocked",
    "auth.earlyRegistration",
    "auth.emailChange",
    "auth.passwordReset",
    "auth.verification",
    "user.earlyRegistrationComplete",
    "user.registrationComplete",
  ]);
  for (const key of keys) {
    const { message } = await messageRegistry[key].definition();
    assert.ok(messagingLayouts.some((entry) => entry.plug.key === message.layout), key);
  }
});

test("管理者コマンド: 非管理者は読み込まない、管理者は上流の 3 カテゴリを今の順で、プラグイン 0", async () => {
  let calls = 0;
  const spy = [{ name: "x", load: async () => { calls += 1; return {} as never; } }];
  assert.equal(await loadForAdmin(false, { categories: spy, plugins: spy }), null);
  assert.equal(calls, 0);
  assertUpstreamItems(categories.map((c) => c.name), ["navigation", "settings", "userSession"]);
  if (isTier1) assert.deepEqual(plugins, []);
  assertUpstreamItems(adminCommandNavigationItems.flatMap((entry) => entry.plug).map((i) => i.id), ["nav-admin-home", "nav-admin-users-general", "nav-admin-settings"]);
});

test("デモ: カテゴリ分けと項目の集合が移設前と同じ、カテゴリの中はフォルダ名の順、閉じたデモは除く", () => {
  const expected = {
    form: ["field-layout", "form-components", "media-input"],
    overlay: ["async-picker-modal", "overlay", "popover"],
    ui: ["block-appearance", "fade-slider", "scroll-slider", "sortable-list", "status-badge", "tables"],
    media: ["seamless-av", "seamless-video"],
    auth: ["fingerprint", "google-popup", "google-redirect"],
    payment: ["bank-transfer-vision", "dummy-payment"],
  };
  const groups = groupDemoPagesByCategory(demoPages);
  const byKey = Object.fromEntries(groups.map((g) => [g.key, g.pages.map((p) => p.folder)]));
  for (const [key, folders] of Object.entries(expected)) assertUpstreamItems(byKey[key] ?? [], folders);
  if (isTier1) assert.deepEqual(groups.map((g) => g.key), DEMO_CATEGORIES.map((c) => c.key));
  const open = openDemoPages(demoPages, (href) => href === "/demo/tables" || href.startsWith("/demo/tables/"));
  assert.equal(open.length, demoPages.length - 1);
  assert.equal(open.some((p) => p.folder === "tables"), false);
});

test("マイルストーンのレンダラー: 上流の項目は 0", () => {
  if (isTier1) assert.deepEqual(milestoneRenderers, []);
});

test("チャット添付: 既定の許可種別、種別が空は通す、サイズ上限は今までどおり", tier1Only, () => {
  const file = (type: string, size = 1) => ({ type, size }) as File;
  assert.equal(validateChatFile(file("image/png"), "image").valid, true);
  assert.equal(validateChatFile(file("video/mp4"), "image").valid, false);
  assert.equal(validateChatFile(file("video/mp4"), "video").valid, true);
  assert.equal(validateChatFile(file("application/pdf"), "file").valid, true);
  assert.equal(validateChatFile(file(""), "file").valid, true);
  assert.equal(validateChatFile(file("image/png", 1024 ** 3), "image").valid, false);
  assert.deepEqual(chatRoomConfig.attachmentContentTypes.image, ["image/*"]);
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

test("root の lang・viewport の既定: 例の lang は ja で OGP の locale と揃う、viewport は root の枠の既定", tier1Only, () => {
  assert.equal(EXAMPLE_BUSINESS.htmlLang, "ja");
  assert.equal(EXAMPLE_BUSINESS.seo.locale, "ja_JP");
  assert.deepEqual(ROOT_LAYOUT_CONFIG.viewport, { width: "device-width", initialScale: 1, viewportFit: "cover" });
});

test("root の lang・viewport: layout は事業の素性と root の枠の config を読む", () => {
  const layout = readFileSync(join(ROOT, "src/app/layout.tsx"), "utf8");
  assert.match(layout, /lang=\{business\.htmlLang\}/);
  assert.match(layout, /export const viewport: Viewport = ROOT_LAYOUT_CONFIG\.viewport;/);
});
