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
import { matchesPath, patternSpecificity } from "@/lib/pathPattern/index.mjs";

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

test("gate.path: 閉じた規則の住所なら当たった閉じた住所のうち一番細かい一致の規則の名前と redirectTo、開いていれば open:true", () => {
  for (const rule of rules.filter((r) => !r.enabled())) {
    for (const pattern of rule.pathPatterns) {
      const pathname = pattern.replace(/^=/, "");
      const hits = rules
        .filter((r) => !r.enabled())
        .flatMap((r) => r.pathPatterns.filter((p) => matchesPath(pathname, p)).map((p) => ({ r, s: patternSpecificity(p) })));
      const best = hits.reduce((a, b) => (b.s > a.s ? b : a)).r;
      assert.deepEqual(gate.path(pathname), { open: false, rule: best.name, redirectTo: best.redirectTo });
    }
  }
  assert.deepEqual(gate.path("/__no_such_gated_path__"), { open: true });
});

test("gate.path: 汎用 API と cron の住所はドメインの開閉で閉じる(規則の pathPatterns には無い)。持ち主が閉ならその名前", () => {
  withRules({ wallet: false }, () => {
    assert.ok(!ruleOf("wallet").pathPatterns.includes("/api/wallet"), "導出の住所は規則の pathPatterns に入れない");
    assert.deepEqual(gate.path("/api/wallet"), { open: false, rule: "wallet", redirectTo: undefined });
    assert.deepEqual(gate.path("/api/walletHistory/1"), { open: false, rule: "wallet", redirectTo: undefined });
    assert.deepEqual(gate.path("/api/cron/wallet-lots-prune"), { open: false, rule: "wallet", redirectTo: undefined });
  });
  withRules({}, () => {
    assert.deepEqual(gate.path("/api/wallet"), { open: true });
    assert.deepEqual(gate.path("/api/cron/wallet-lots-prune"), { open: true });
  });
});

const ruleAt = (pathname: string) => {
  const result = gate.path(pathname);
  return result.open ? null : result.rule;
};

test("gate.path: 入れ子は一番細かい一致(招待クーポンの管理画面 ⊂ クーポンの管理画面)", () => {
  withRules({ coupon: false, referral: false }, () => {
    assert.equal(ruleAt("/admin/coupons/invite"), "referral");
    assert.equal(ruleAt("/admin/coupons"), "coupon");
  });
  withRules({ coupon: false }, () => {
    assert.equal(ruleAt("/admin/coupons/invite"), "coupon", "子が開でも親の閉で閉");
  });
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
    // 全部閉: 手書きの住所(一覧の順)+ 導出の住所(汎用 API・cron は /api の下なので枠に出ない)を、一番細かい順に並べ直した物
    const expectAll = rules
      .flatMap((rule) => rule.pathPatterns.map((pattern) => ({ pattern, rule: rule.name })))
      .map((entry, index) => ({ entry, index, s: patternSpecificity(entry.pattern) }))
      .sort((a, b) => b.s - a.s || a.index - b.index)
      .map(({ entry }) => entry);
    assert.deepEqual(
      admin.closed.map((e) => ({ pattern: e.pattern, rule: e.rule })),
      expectAll.filter((e) => !under(e.pattern, "/api")),
      "admin の枠 = /api を除く全部(一番細かい順、同じ細かさは一覧の順)",
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

const fixtureRule = (name: string, over: Partial<GatedFeatureRule> = {}): GatedFeatureRule =>
  ({ name, pathPatterns: ["/x"], features: ["x"], enabled: () => false, tables: ["xs"], domainApiPaths: ["/api/x"], settingPaths: ["/admin/settings/x"], cronPaths: [], ...over }) as GatedFeatureRule;

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

const RULE_TEXT = 'import type { FeatureGateRule } from "@/featureGate";\n\nexport const rule: FeatureGateRule = {\n  pathPatterns: ["/admin/shops"],\n};\n';
const SWITCHES_EMPTY = 'import type { FeatureSwitches } from "@/featureGate";\n\nexport default {} satisfies FeatureSwitches;\n';
const plan = (over: Partial<Parameters<typeof planFeatureSetFromText>[0]>) =>
  planFeatureSetFromText({ name: "shop", tier1: false, ruleFile: "src/featureGate/rules/shop.ts", ruleText: RULE_TEXT, switchesText: SWITCHES_EMPTY, value: false, requiredReason: null, ...over });

test("pnpm ops features set の計画(fork): switches.config.ts の 1 行を足す・書き換える(既定と同じでも消さない、L1.26)", () => {
  const off = plan({});
  assert.ok(off.kind === "write");
  assert.equal(off.configFile, "src/config/featureGate/switches.config.ts");
  assert.equal(off.after, SWITCHES_EMPTY.replace("export default {}", "export default { shop: false }"));
  const multi = 'export default {\n  wallet: false,\n} satisfies FeatureSwitches;\n';
  const added = plan({ switchesText: multi });
  assert.ok(added.kind === "write" && added.after === 'export default {\n  shop: false,\n  wallet: false,\n} satisfies FeatureSwitches;\n');
  const flipped = plan({ name: "wallet", switchesText: multi, value: true });
  assert.ok(flipped.kind === "write" && flipped.after === multi.replace("wallet: false", "wallet: true") && flipped.changed);
  const same = plan({ name: "wallet", switchesText: multi, value: false });
  assert.ok(same.kind === "write" && !same.changed, "同じ値なら書き換えない(消さない)");
});

test("pnpm ops features set の計画(Tier1): 規則のファイルの defaultEnabled を足す・書き換える", () => {
  const off = plan({ tier1: true });
  assert.ok(off.kind === "write");
  assert.equal(off.configFile, "src/featureGate/rules/shop.ts");
  assert.equal(off.after, RULE_TEXT.replace("export const rule: FeatureGateRule = {\n", "export const rule: FeatureGateRule = {\n  defaultEnabled: false,\n"));
  const withDefault = RULE_TEXT.replace('  pathPatterns: ["/admin/shops"],\n', '  pathPatterns: ["/admin/shops"],\n  defaultEnabled: false,\n');
  const on = plan({ tier1: true, ruleText: withDefault, value: true });
  assert.ok(on.kind === "write" && on.after === withDefault.replace("defaultEnabled: false", "defaultEnabled: true"));
});

test("pnpm ops features set の計画: 必須は off にしない(on はよい)、書けない形は理由", () => {
  assert.deepEqual(plan({ requiredReason: "中心" }), { kind: "required", reason: "中心" });
  assert.equal(plan({ requiredReason: "中心", value: true }).kind, "write");
  const notLiteral = plan({ switchesText: "const x = {};\nexport default x;\n" });
  assert.ok(notLiteral.kind === "unwritable" && /オブジェクトのリテラルでない/.test(notLiteral.why));
  const expr = plan({ switchesText: "export default { shop: FLAG } satisfies FeatureSwitches;\n" });
  assert.ok(expr.kind === "unwritable" && /リテラルの 1 つでない/.test(expr.why));
  const missing = plan({ switchesText: null });
  assert.ok(missing.kind === "unwritable" && /switches\.config\.ts が無い/.test(missing.why));
  const noRule = plan({ tier1: true, ruleText: "export const x = 1;\n" });
  assert.ok(noRule.kind === "unwritable");
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
