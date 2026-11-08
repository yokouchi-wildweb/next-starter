// src/featureGate/checks/gateTools.test.ts
// gate の束の道具の回帰テスト(D23): gate.enabled は規則名で引けて規則の enabled() を返し、未知の名前は型で落ち実行時は throw。
// gate.path は一覧の順で最初の閉じた規則を返す。gate.assert は閉なら 404 の DomainError(機能名を出さない)。
// gate.filter は '/' で始まる内部の住所で redirectTo の無い閉じた規則に当たる項目だけを除く(判定 hiddenHref.ts)。
// clientGateState は全規則の開閉と、枠(user / admin)で絞った閉じた住所を返す。束の名前: client ⊆ server、server だけの名前は SERVER_ONLY に限る。
// 閉じた状態は一覧の規則の enabled を一時的に差し替えて作る(config の値に依らない)。
// 型の検査は pnpm typecheck(@ts-expect-error の行)、実行は pnpm test src/featureGate/checks/gateTools.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";

import { gate, type FeatureGateRule, type FeatureName, type GatedFeatureRule } from "@/featureGate";
import { clientGateState } from "@/featureGate";
import { isHiddenHref } from "@/featureGate/hiddenHref";
import { clientTools } from "@/featureGate/tools/client";
import { serverTools } from "@/featureGate/tools/server";
import { isDomainError } from "@/lib/errors";
import { rules } from "@/featureGate/node";
import { matchesPath } from "@/lib/pathPattern/index.mjs";

test("gate.enabled: 規則のファイル名で引け、規則の enabled() の答えを返す", () => {
  assert.ok(rules.length > 0);
  for (const rule of rules) assert.equal(gate.enabled(rule.name), rule.enabled());
  const wallet: FeatureName = "wallet";
  assert.equal(typeof gate.enabled(wallet), "boolean");
});

test("gate.enabled: 未知の名前は型で落ち、実行時は throw", () => {
  // @ts-expect-error 規則の無い名前は FeatureName に無い
  assert.throws(() => gate.enabled("noSuchFeature"), /未知の機能の名前 "noSuchFeature"/);
  assert.throws(() => gate.enabled("constructor" as FeatureName), /未知の機能の名前/);
});

test("gate.path: 閉じた規則の住所なら一覧の順で最初の閉じた規則の名前と redirectTo、開いていれば open:true", () => {
  for (const rule of rules.filter((r) => !r.enabled())) {
    for (const pattern of rule.pathPatterns) {
      const pathname = pattern.replace(/^=/, "");
      const first = rules.find((r) => !r.enabled() && r.pathPatterns.some((p) => matchesPath(pathname, p)));
      assert.deepEqual(gate.path(pathname), { open: false, rule: first?.name, redirectTo: first?.redirectTo });
    }
  }
  assert.deepEqual(gate.path("/__no_such_gated_path__"), { open: true });
});

/** 規則の enabled を一時的に差し替えて fn を走らせる(終われば戻す) */
function withRules(states: Partial<Record<FeatureName, boolean>>, fn: () => void) {
  const saved = new Map<GatedFeatureRule, GatedFeatureRule["enabled"]>();
  for (const rule of rules) {
    saved.set(rule, rule.enabled);
    const state = states[rule.name];
    rule.enabled = () => state ?? true;
  }
  try {
    fn();
  } finally {
    for (const [rule, enabled] of saved) rule.enabled = enabled;
  }
}

const ruleOf = (name: FeatureName) => {
  const rule = rules.find((r) => r.name === name);
  assert.ok(rule, `規則 ${name} が無い`);
  return rule;
};

test("gate.assert: 開なら何もせず、閉なら 404 の DomainError(決まった文言、機能名・code・details なし)", () => {
  for (const rule of rules) {
    withRules({}, () => assert.doesNotThrow(() => gate.assert(rule.name)));
    withRules({ [rule.name]: false }, () => {
      let caught: unknown;
      try {
        gate.assert(rule.name);
      } catch (error) {
        caught = error;
      }
      assert.ok(isDomainError(caught), `${rule.name}: DomainError でない`);
      assert.equal(caught.status, 404);
      assert.equal(caught.message, "お探しのページは見つかりませんでした");
      assert.equal(caught.code, undefined);
      assert.equal(caught.details, undefined);
      assert.ok(!caught.message.includes(rule.name));
    });
  }
});

test("gate.assert: 未知の名前は型で落ち、実行時は throw", () => {
  // @ts-expect-error 規則の無い名前は FeatureName に無い
  assert.throws(() => gate.assert("noSuchFeature"), /未知の機能の名前 "noSuchFeature"/);
});

test("gate.filter: 規則を 1 つずつ閉じ、その住所の項目だけが除かれる(redirectTo 付きは残す)", () => {
  for (const rule of rules) {
    withRules({ [rule.name]: false }, () => {
      for (const pattern of rule.pathPatterns) {
        const pathname = pattern.replace(/^=/, "");
        const items = [
          { href: "/__open_before__" },
          { href: pathname },
          { href: `${pathname}?q=1#x` },
          { href: "/__open_after__" },
        ];
        const expected = rule.redirectTo === undefined ? [items[0], items[3]] : items;
        assert.deepEqual(gate.filter(items), expected, `${rule.name} ${pattern}`);
      }
    });
  }
});

test("gate.filter: 内部の住所だけを見る・href の無い項目は残す・getHref で引ける・順を保つ", () => {
  const wallet = ruleOf("wallet");
  const closedPath = wallet.pathPatterns[0].replace(/^=/, "");
  withRules({ wallet: false }, () => {
    const items = [
      { href: `https://example.com${closedPath}` },
      { href: `//example.com${closedPath}` },
      { href: undefined },
      { href: null },
      { href: closedPath },
      { href: "/" },
    ];
    assert.deepEqual(gate.filter(items), [items[0], items[1], items[2], items[3], items[5]]);
    const rows = [{ to: "/" }, { to: closedPath }, { to: "" }];
    assert.deepEqual(
      gate.filter(rows, (row) => row.to || undefined),
      [rows[0], rows[2]],
    );
    // @ts-expect-error href を持たない型は getHref が必須
    gate.filter(rows);
  });
  withRules({}, () => {
    const items = [{ href: closedPath }];
    const result = gate.filter(items);
    assert.deepEqual(result, items);
    assert.notEqual(result, items, "新しい配列を返す");
  });
});

test("isHiddenHref: 並びの順で最初に当たった閉じた住所の redirectTo で決まる", () => {
  const closed = [
    { pattern: "/a", rule: "signup" as FeatureName, redirectTo: "/a-closed" },
    { pattern: "/a/b", rule: "wallet" as FeatureName },
  ];
  assert.equal(isHiddenHref("/a/b", closed), false);
  assert.equal(isHiddenHref("/a/b", [...closed].reverse()), true);
  assert.equal(isHiddenHref("/x", closed), false);
  assert.equal(isHiddenHref("a/b", [{ pattern: "/a", rule: "wallet" as FeatureName }]), false);
});

/** パターンの住所が /admin・/api の下か */
const under = (pattern: string, prefix: string) => matchesPath(pattern.replace(/^=/, ""), prefix);

test("clientGateState: 全規則の開閉と、枠で絞った閉じた住所(user = /admin・/api を除く、admin = user + /admin)", () => {
  const all = Object.fromEntries(rules.map((rule) => [rule.name, false]));
  withRules(all, () => {
    const user = clientGateState("user");
    const admin = clientGateState("admin");
    assert.equal(user.area, "user");
    assert.equal(admin.area, "admin");
    for (const state of [user, admin]) {
      assert.deepEqual(Object.keys(state.enabled).sort(), rules.map((r) => r.name).sort());
      assert.ok(Object.values(state.enabled).every((v) => v === false));
      assert.ok(state.closed.every((e) => !under(e.pattern, "/api")), "/api の下は渡さない");
      assert.ok(state.closed.every((e) => !("redirectTo" in e) || typeof e.redirectTo === "string"), "redirectTo は無いか文字列");
    }
    assert.ok(user.closed.every((e) => !under(e.pattern, "/admin")), "利用者の枠に /admin の住所は出さない");
    const expectAll = rules.flatMap((rule) => rule.pathPatterns.map((pattern) => ({ pattern, rule: rule.name })));
    assert.deepEqual(
      admin.closed.map((e) => ({ pattern: e.pattern, rule: e.rule })),
      expectAll.filter((e) => !under(e.pattern, "/api")),
      "admin の枠 = /api を除く全部(一覧の順)",
    );
    assert.deepEqual(
      user.closed.map((e) => e.pattern),
      admin.closed.map((e) => e.pattern).filter((p) => !under(p, "/admin")),
    );
    assert.ok(admin.closed.some((e) => under(e.pattern, "/admin")), "管理の住所を持つ規則がある前提");
  });
  withRules({}, () => {
    assert.deepEqual(clientGateState("admin").closed, []);
    assert.ok(Object.values(clientGateState("user").enabled).every((v) => v === true));
  });
});

/** server だけの道具(client の束に無くてよい名前) */
const SERVER_ONLY = ["assert"];

test("束の名前の一致: client の束の名前 ⊆ server の束、server だけの名前は SERVER_ONLY に限る", () => {
  const server = Object.keys(serverTools).sort();
  const client = Object.keys(clientTools).sort();
  assert.deepEqual(client.filter((name) => !server.includes(name)), [], "client だけの名前がある");
  assert.deepEqual(server.filter((name) => !client.includes(name)), [...SERVER_ONLY].sort(), "server だけの名前が SERVER_ONLY と違う");
});

// ── pnpm ops features list / pnpm ops features set の道具(node/describe.ts・node/setEnabled.ts、L1.19) ──
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describeFeatures, planFeatureSetFromText, readFeatureReport } from "@/featureGate/node";
import { findCallSites } from "@/featureGate/node/describe";
import { readOverrideFile, readRuleConfigTarget, rewriteConfigEnabled, rewriteOverrideEnabled } from "@/featureGate/node/setEnabled";

const fixtureRule = (name: string, over: Partial<GatedFeatureRule> = {}): GatedFeatureRule =>
  ({ name, pathPatterns: ["/x", "/api/x", "/admin/settings/x"], features: ["x"], enabled: () => false, tables: ["xs"], domainApiPaths: ["/api/x"], settingPaths: ["/admin/settings/x"], cronPaths: [], ...over }) as GatedFeatureRule;

test("describeFeatures: 住所を手書き / 導出に分け、依存・呼び出し・必須を規則ごとに", () => {
  const [x, y] = describeFeatures([fixtureRule("x"), fixtureRule("y", { pathPatterns: ["/y"], features: [], tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], enabled: () => true })], {
    dependencies: [
      { file: "src/a.ts", folder: "x", rule: "x", allowedBy: "gate" },
      { file: "src/b.ts", folder: "x", rule: "x", allowedBy: null },
    ],
    callSites: { x: ["src/a.ts"] },
    required: { y: "この fork の中心" },
  });
  assert.deepEqual(x.paths, { handWritten: ["/x"], domainApi: ["/api/x"], setting: ["/admin/settings/x"], cron: [] });
  assert.equal(x.enabled, false);
  assert.equal(x.required, null);
  assert.deepEqual(x.dependents.map((d) => d.allowedBy), ["gate", null]);
  assert.deepEqual(x.callSites, ["src/a.ts"]);
  assert.equal(y.required, "この fork の中心");
  assert.deepEqual(y.dependents, []);
});

test("findCallSites: gate.enabled / gate.assert / useGate().enabled の字面の名前(門番の中・テストは除く)", () => {
  const root = mkdtempSync(join(tmpdir(), "gate-calls-"));
  mkdirSync(join(root, "src/app"), { recursive: true });
  mkdirSync(join(root, "src/featureGate"), { recursive: true });
  writeFileSync(join(root, "src/app/a.ts"), 'gate.enabled("wallet"); gate.assert(\'payment\'); useGate().enabled(`wallet`); gate.enabled(name);\n');
  writeFileSync(join(root, "src/app/a.test.ts"), 'gate.enabled("wallet");\n');
  writeFileSync(join(root, "src/featureGate/b.ts"), 'gate.enabled("wallet");\n');
  writeFileSync(join(root, "src/app/c.ts"), 'gate.enabled("unknown");\n');
  assert.deepEqual(findCallSites(root, ["wallet", "payment"]), { wallet: ["src/app/a.ts"], payment: ["src/app/a.ts"] });
});

const RULE_WRITABLE = 'import { SHOP_CONFIG } from "@/features/shop/config";\n\nexport const rule = {\n  pathPatterns: ["/admin/shops"],\n  enabled: () => SHOP_CONFIG.enabled,\n};\n';
const CONFIG = "export const SHOP_CONFIG = {\n  /** この機能を使うか */\n  enabled: true,\n  limit: 3,\n};\n";

test("pnpm ops features set の計画: 書ける形は config の enabled の 1 行だけを書き換える", () => {
  const files: Record<string, string> = { "src/features/shop/config.ts": CONFIG };
  const plan = planFeatureSetFromText({ ruleText: RULE_WRITABLE, configFile: (f) => `src/features/${f}/config.ts`, readConfig: (f) => files[f] ?? null, value: false, requiredReason: null });
  assert.equal(plan.kind, "write");
  if (plan.kind !== "write") return;
  assert.equal(plan.after, CONFIG.replace("enabled: true", "enabled: false"));
  assert.equal(plan.changed, true);
  const same = planFeatureSetFromText({ ruleText: RULE_WRITABLE, configFile: (f) => `src/features/${f}/config.ts`, readConfig: (f) => files[f] ?? null, value: true, requiredReason: null });
  assert.ok(same.kind === "write" && same.changed === false);
});

test("pnpm ops features set の計画: 必須は off にしない(on はよい)、書けない形は理由と enabled の字面", () => {
  const read = () => CONFIG;
  const cfg = (f: string) => `src/features/${f}/config.ts`;
  assert.deepEqual(planFeatureSetFromText({ ruleText: RULE_WRITABLE, configFile: cfg, readConfig: read, value: false, requiredReason: "中心" }), { kind: "required", reason: "中心" });
  assert.equal(planFeatureSetFromText({ ruleText: RULE_WRITABLE, configFile: cfg, readConfig: read, value: true, requiredReason: "中心" }).kind, "write");
  const shared = planFeatureSetFromText({ ruleText: "export const rule = { enabled: () => APP_FEATURES.wallet.enabled };\n", configFile: cfg, readConfig: read, value: false, requiredReason: null });
  assert.ok(shared.kind === "unwritable" && shared.enabledSource === "() => APP_FEATURES.wallet.enabled");
  const notDomain = planFeatureSetFromText({ ruleText: 'import { SHOP_CONFIG } from "@/config/app/shop.config";\nexport const rule = { enabled: () => SHOP_CONFIG.enabled };\n', configFile: cfg, readConfig: read, value: false, requiredReason: null });
  assert.ok(notDomain.kind === "unwritable" && /import されていない/.test(notDomain.why));
  const missing = planFeatureSetFromText({ ruleText: RULE_WRITABLE, configFile: cfg, readConfig: () => null, value: false, requiredReason: null });
  assert.ok(missing.kind === "unwritable" && /が無い/.test(missing.why));
  const expr = planFeatureSetFromText({ ruleText: RULE_WRITABLE, configFile: cfg, readConfig: () => "export const SHOP_CONFIG = { enabled: process.env.X === '1' };\n", value: false, requiredReason: null });
  assert.ok(expr.kind === "unwritable" && /リテラル/.test(expr.why));
});

test("pnpm ops features set の読み取り: core のドメイン・入れ子の enabled は書かない", () => {
  assert.deepEqual(readRuleConfigTarget('import { W_CONFIG } from "@/features/core/wallet/config";\nexport const rule = { enabled: () => W_CONFIG.enabled };\n'), { constName: "W_CONFIG", folder: "core/wallet" });
  assert.equal(rewriteConfigEnabled("export const S_CONFIG = { enabled: true, sub: { enabled: false } };\n", "S_CONFIG", false), null);
  assert.equal(rewriteConfigEnabled("export const OTHER = { enabled: true };\n", "S_CONFIG", false), null);
});

const OWNER_CONFIG = 'import override from "@/config/features/shop.config";\nimport { defineConfig } from "@/lib/defineConfig";\n\nconst defaults = { enabled: true };\nexport const SHOP_CONFIG = defineConfig(defaults).compose(override);\n';
const OVERRIDE_HEAD = '// 上書き\nimport type { ShopOverride } from "@/features/shop/config";\n\n';

test("pnpm ops features set の計画: 上書きを合成する持ち主は上書きの enabled を書く(目録 D19、L1.26 = いつも true|false)", () => {
  const cfg = (f: string) => `src/features/${f}/config.ts`;
  const plan = (override: string | null, value: boolean) =>
    planFeatureSetFromText({
      ruleText: RULE_WRITABLE,
      configFile: cfg,
      readConfig: (f) => ({ "src/features/shop/config.ts": OWNER_CONFIG, "src/config/features/shop.config.ts": override })[f] ?? null,
      value,
      requiredReason: null,
    });
  // 空の上書き → { enabled: false }。既定と同じ on でも書く
  const empty = plan(`${OVERRIDE_HEAD}export default {} satisfies ShopOverride;\n`, false);
  assert.ok(empty.kind === "write" && empty.configFile === "src/config/features/shop.config.ts");
  if (empty.kind === "write") assert.equal(empty.after, `${OVERRIDE_HEAD}export default { enabled: false } satisfies ShopOverride;\n`);
  const on = plan(`${OVERRIDE_HEAD}export default {} satisfies ShopOverride;\n`, true);
  assert.ok(on.kind === "write" && on.changed && on.after.includes("{ enabled: true }"));
  // 既にある enabled を書き換え、他のキー・型の行・文字列の中の括弧はそのまま
  const existing = `${OVERRIDE_HEAD}export type Extra = { note: string };\n\nexport default {\n  limit: 5,\n  enabled: true,\n  note: "{{X}} } {",\n  sub: { enabled: true },\n} satisfies ShopOverride<Extra>;\n`;
  const rewritten = plan(existing, false);
  assert.ok(rewritten.kind === "write");
  if (rewritten.kind === "write") assert.equal(rewritten.after, existing.replace("  enabled: true,\n  note", "  enabled: false,\n  note"));
  // 複数行の上書きに enabled が無ければ先頭に足す(入れ子の enabled は数えない)
  const multi = plan(`${OVERRIDE_HEAD}export default {\n  limit: 5,\n  sub: { enabled: true },\n} satisfies ShopOverride;\n`, false);
  assert.ok(multi.kind === "write" && multi.after.includes("export default {\n  enabled: false,\n  limit: 5,\n  sub: { enabled: true },"));
  // 上書きが無い・default export がオブジェクトでない → 書かない
  const missing = plan(null, false);
  assert.ok(missing.kind === "unwritable" && /shop\.config\.ts が無い/.test(missing.why));
  const notObject = plan(`${OVERRIDE_HEAD}const x = {};\nexport default x;\n`, false);
  assert.ok(notObject.kind === "unwritable" && /オブジェクトのリテラル/.test(notObject.why));
  // 上書きを持たない持ち主は今どおり config.ts のリテラル
  assert.equal(readOverrideFile(CONFIG), null);
  assert.equal(readOverrideFile(OWNER_CONFIG), "src/config/features/shop.config.ts");
  assert.equal(rewriteOverrideEnabled("export default { enabled: true, a: { enabled: false }, enabled: false };\n", true), null);
});

test("readFeatureReport: 上流の全規則で動く(依存は依存の検査の走査と同じ物)", async () => {
  const report = await readFeatureReport(process.cwd(), rules);
  assert.deepEqual(report.map((d) => d.name), rules.map((r) => r.name));
  const wallet = report.find((d) => d.name === "wallet");
  assert.ok(wallet && wallet.tables.includes("wallets") && wallet.dependents.length > 0 && wallet.callSites.length > 0);
  // 上流の違反は無い(縮む表は 0 行で消した)
  const unlisted = report.flatMap((d) => d.dependents.filter((dep) => dep.allowedBy === null).map((dep) => `${dep.file} → ${dep.folder}`));
  assert.deepEqual(unlisted, []);
});
