// src/featureGate/checks/dependsOn.test.ts
// 機能どうしの依存(dependsOn、D24・D34)の回帰テスト:
// - 評価(ruleList.ts の resolveFeatureOpen): 開 = 自分 && 依存先が全部開(推移的)。親が閉 → 子・孫が閉、enabled 省略の子は依存先しだい、輪は throw
// - 推移的な依存先・依存元、全開スイッチの名前指定の足りない名前(missingSwitchDependencies)
// - pnpm ops features list の説明(describeFeatures): dependsOn・dependsOnAll・dependedOnBy・closedBy・switchMissing
// - pnpm ops features set の計画: 必須の機能が推移的に依存する機能の off は止める(連鎖)、on で依存先が閉なら書いた上で名前を返す
// 生成器の検査(未知・自分・重複・輪・非リテラル)は scripts/structure/extensions/extensions.test.mjs、実物の一覧での連鎖と全開スイッチは
// scripts/structure/proxies/openSwitch.test.ts。実行: pnpm test src/featureGate/checks/dependsOn.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";

import type { FeatureName, GatedFeatureRule } from "@/featureGate";
import { describeFeatures, planFeatureSet, planFeatureSetFromText, requiredDependencyChains } from "@/featureGate/node";
import {
  missingSwitchDependencies,
  resolveFeatureOpen,
  transitiveDependencies,
  transitiveDependents,
} from "@/featureGate/ruleList";

// parent ← child ← grandchild、parent ← sibling(enabled 省略の子)、loner は依存なし
const GRAPH = [
  { name: "parent", dependsOn: [] },
  { name: "child", dependsOn: ["parent"] },
  { name: "grandchild", dependsOn: ["child"] },
  { name: "sibling", dependsOn: ["parent"] },
  { name: "loner", dependsOn: [] },
];

test("評価: 親が閉 → 子・孫が閉、自分が閉なら依存先が開でも閉、依存の無い機能は自分の値", () => {
  const self = (closed: string[]) => (name: string) => !closed.includes(name);
  const all = (closed: string[]) => GRAPH.map((n) => [n.name, resolveFeatureOpen(GRAPH, self(closed))(n.name)]);
  assert.deepEqual(Object.fromEntries(all([])), { parent: true, child: true, grandchild: true, sibling: true, loner: true });
  assert.deepEqual(Object.fromEntries(all(["parent"])), { parent: false, child: false, grandchild: false, sibling: false, loner: true });
  assert.deepEqual(Object.fromEntries(all(["child"])), { parent: true, child: false, grandchild: false, sibling: true, loner: true });
  assert.deepEqual(Object.fromEntries(all(["grandchild"])), { parent: true, child: true, grandchild: false, sibling: true, loner: true });
});

test("評価: enabled 省略の子(自分は開)は依存先しだい", () => {
  // sibling は enabled を書かない規則 = 自分はいつも開
  const ownOmitted = (parentOpen: boolean) => (name: string) => (name === "parent" ? parentOpen : true);
  assert.equal(resolveFeatureOpen(GRAPH, ownOmitted(true))("sibling"), true);
  assert.equal(resolveFeatureOpen(GRAPH, ownOmitted(false))("sibling"), false);
});

test("評価: 未知の名前・輪は throw(輪は生成器が止めるが、作り物の一覧でも黙って通さない)", () => {
  assert.throws(() => resolveFeatureOpen(GRAPH, () => true)("nowhere"), /未知の機能の名前 "nowhere"/);
  const cyclic = [
    { name: "a", dependsOn: ["b"] },
    { name: "b", dependsOn: ["a"] },
  ];
  assert.throws(() => resolveFeatureOpen(cyclic, () => true)("a"), /輪になっている\(a → b → a\)/);
});

test("推移的な依存先(近い順)・依存元(一覧の順)", () => {
  assert.deepEqual(transitiveDependencies(GRAPH, "grandchild"), ["child", "parent"]);
  assert.deepEqual(transitiveDependencies(GRAPH, "parent"), []);
  assert.deepEqual(transitiveDependents(GRAPH, "parent"), ["child", "grandchild", "sibling"]);
  assert.deepEqual(transitiveDependents(GRAPH, "grandchild"), []);
});

test("全開スイッチの名前指定: 名前で開けた機能の、自分が閉の推移的な依存先が足りない名前。all・未設定は空", () => {
  const closed = new Set(["parent", "child"]);
  const opened = new Set(["grandchild"]);
  const self = (name: string) => opened.has(name) || !closed.has(name);
  assert.deepEqual(missingSwitchDependencies(GRAPH, opened, self), { grandchild: ["child", "parent"] });
  // 依存先もスイッチに足せば足りない名前は無い
  const both = new Set(["grandchild", "child", "parent"]);
  assert.deepEqual(missingSwitchDependencies(GRAPH, both, (name) => both.has(name) || !closed.has(name)), {});
  assert.deepEqual(missingSwitchDependencies(GRAPH, "all", () => true), {});
  assert.deepEqual(missingSwitchDependencies(GRAPH, null, self), {});
});

// ---- pnpm ops features list ----

const rule = (name: string, dependsOn: string[], open: boolean): GatedFeatureRule =>
  ({ name, dependsOn, pathPatterns: [], features: [], tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], enabled: () => open }) as unknown as GatedFeatureRule;

test("describeFeatures: dependsOn・推移的な依存先と依存元・閉の理由(自分の値 / 依存先)・足りない名前", () => {
  // parent は自分の値で閉、child は自分は開で依存先 parent が閉、grandchild はスイッチで開けたが依存先が閉
  const list = [rule("parent", [], false), rule("child", ["parent"], false), rule("grandchild", ["child"], false), rule("loner", [], true)];
  const [parent, child, grandchild, loner] = describeFeatures(list, {
    dependencies: [],
    callSites: {},
    required: {},
    switchState: {
      parent: { configEnabled: false, openedBySwitch: false, ownEnabled: false },
      child: { configEnabled: false, openedBySwitch: false, ownEnabled: true },
      grandchild: { configEnabled: false, openedBySwitch: true, ownEnabled: false },
      loner: { configEnabled: true, openedBySwitch: false, ownEnabled: true },
    },
    switchMissing: { grandchild: ["child", "parent"] },
  });
  assert.deepEqual(parent.closedBy, { self: true, dependencies: [] });
  assert.deepEqual(parent.dependedOnBy, ["child", "grandchild"]);
  assert.deepEqual(child.closedBy, { self: false, dependencies: ["parent"] });
  assert.deepEqual([child.dependsOn, child.dependsOnAll, child.dependedOnBy], [["parent"], ["parent"], ["grandchild"]]);
  assert.deepEqual(grandchild.closedBy, { self: false, dependencies: ["child"] });
  assert.deepEqual(grandchild.dependsOnAll, ["child", "parent"]);
  assert.deepEqual(grandchild.switchMissing, ["child", "parent"]);
  assert.equal(loner.closedBy, null);
  assert.deepEqual([loner.dependsOn, loner.switchMissing], [[], []]);
  // --json にも載る(読み手は FeatureDescription をそのまま出す)
  assert.deepEqual(Object.keys(JSON.parse(JSON.stringify(child))).filter((k) => /depend|closedBy|switchMissing|ownEnabled/.test(k)).sort(), [
    "closedBy",
    "dependedOnBy",
    "dependents",
    "dependsOn",
    "dependsOnAll",
    "ownEnabled",
    "switchMissing",
  ]);
});

// ---- pnpm ops features set ----

const RULE = 'export const rule: FeatureGateRule = {\n  pathPatterns: ["/admin/shops"],\n};\n';
const base = { name: "shop", tier1: false, ruleFile: "src/featureGate/rules/shop.ts", ruleText: RULE, switchesText: "export default {} satisfies FeatureSwitches;\n", requiredReason: null };

test("必須の機能からの依存の連鎖: 推移的に依存する必須の機能ごとに最短の [必須, …, この機能]。自分が必須なのは含めない", () => {
  assert.deepEqual(requiredDependencyChains(GRAPH, "parent", ["grandchild"]), [["grandchild", "child", "parent"]]);
  assert.deepEqual(requiredDependencyChains(GRAPH, "parent", ["grandchild", "sibling", "loner"]), [["grandchild", "child", "parent"], ["sibling", "parent"]]);
  assert.deepEqual(requiredDependencyChains(GRAPH, "parent", ["parent"]), []);
  assert.deepEqual(requiredDependencyChains(GRAPH, "grandchild", ["parent"]), []);
});

test("set の計画: 必須の機能が依存する機能の off は書かずに連鎖を返す(on はよい)", () => {
  const chains = [["grandchild", "child", "parent"]];
  assert.deepEqual(planFeatureSetFromText({ ...base, value: false, requiredChains: chains }), { kind: "requiredDependent", chains });
  const on = planFeatureSetFromText({ ...base, value: true, requiredChains: chains });
  assert.equal(on.kind, "write");
  // 自分が必須なら必須の理由が先
  assert.equal(planFeatureSetFromText({ ...base, value: false, requiredReason: "中心", requiredChains: chains }).kind, "required");
});

test("set の計画: on で依存先が閉なら書いた上で名前を返す(off では返さない)", () => {
  const on = planFeatureSetFromText({ ...base, value: true, closedDependencies: ["parent"] });
  assert.ok(on.kind === "write");
  assert.deepEqual(on.closedDependencies, ["parent"]);
  const off = planFeatureSetFromText({ ...base, value: false, closedDependencies: ["parent"] });
  assert.ok(off.kind === "write");
  assert.deepEqual(off.closedDependencies, []);
});

test("planFeatureSet: 一覧の dependsOn から連鎖と閉じた依存先を組む(実物の規則のファイル wallet で、一覧は作り物)", () => {
  const list = [rule("wallet", ["payment"], true), rule("payment", [], false), rule("referral", ["wallet"], true)];
  const off = planFeatureSet(process.cwd(), "wallet", false, { referral: "紹介が中心" }, list);
  assert.deepEqual(off, { kind: "requiredDependent", chains: [["referral", "wallet"]] });
  // 書き先は Tier で決まる(ここは fork として計画だけ見る = switches.config.ts)
  const sample = [rule("sampleDomain", ["payment"], true), rule("payment", [], false)];
  const on = planFeatureSet(process.cwd(), "sampleDomain" as FeatureName, true, {}, sample, false);
  assert.ok(on.kind === "write", JSON.stringify(on));
  assert.deepEqual(on.closedDependencies, ["payment"]);
  assert.equal(on.configFile, "src/config/featureGate/switches.config.ts");
});

// ---- どれか 1 つ(anyOf、D36)と入切の値の合成(D35) ----

test("評価: anyOf はどれか 1 つが開なら開(dependsOn と両方あれば両方を満たすとき)", async () => {
  const { resolveFeatureOpen } = await import("@/featureGate/ruleList");
  const graph = [
    { name: "mypage", dependsOn: [] },
    { name: "pause", dependsOn: [] },
    { name: "withdraw", dependsOn: [] },
    { name: "other", dependsOn: ["mypage"], anyOf: ["pause", "withdraw"] },
  ];
  const open = (closed: string[]) => resolveFeatureOpen(graph, (n) => !closed.includes(n))("other");
  assert.equal(open([]), true);
  assert.equal(open(["pause"]), true, "退会が開");
  assert.equal(open(["pause", "withdraw"]), false, "どちらも閉");
  assert.equal(open(["mypage"]), false, "dependsOn が閉");
});

test("合成: 自分の値 = (fork の switches ?? 規則の defaultEnabled ?? 開) && 入切でない条件。rules・configRules・ownEnabled が通る", async () => {
  const { default: switches } = await import("@/config/featureGate/switches.config");
  const { rules: generated } = await import("@/featureGate/extensions/rules");
  const { configEnabled, ownEnabled } = await import("@/featureGate/ruleList");
  const values = switches as Record<string, boolean | undefined>;
  const wallet = generated.find((r) => r.name === "wallet")!;
  const savedDefault = wallet.defaultEnabled;
  const savedEnabled = wallet.enabled;
  try {
    wallet.defaultEnabled = true;
    assert.equal(ownEnabled("wallet"), true, "既定だけ");
    values.wallet = false;
    assert.equal(ownEnabled("wallet"), false, "fork の値が既定に勝つ");
    assert.equal(configEnabled("payment"), false, "依存先が閉なら依存元も閉");
    wallet.defaultEnabled = false;
    values.wallet = true;
    assert.equal(ownEnabled("wallet"), true, "fork の値で開ける");
    wallet.enabled = () => false;
    assert.equal(ownEnabled("wallet"), false, "入切でない条件が閉なら閉");
    delete values.wallet;
    wallet.defaultEnabled = undefined;
    wallet.enabled = undefined;
    assert.equal(ownEnabled("wallet"), true, "どれも書かなければ開");
  } finally {
    delete values.wallet;
    wallet.defaultEnabled = savedDefault;
    wallet.enabled = savedEnabled;
  }
});

test("fork の入切の値の検査: 未知の名前・真偽でない値を並べる(読み込みで throw)。上流の switches.config.ts は空", async () => {
  const { switchProblems } = await import("@/featureGate/ruleList");
  const { default: switches } = await import("@/config/featureGate/switches.config");
  const known = new Set(["wallet", "coupon"]);
  assert.deepEqual(switchProblems({ wallet: false }, known), []);
  assert.deepEqual(switchProblems({ walet: false, coupon: "no" }, known), ['未知の機能の名前 "walet"(src/featureGate/rules/<名前>.ts が無い)', '"coupon" の値が true|false でない']);
  assert.deepEqual(switches, {});
});
