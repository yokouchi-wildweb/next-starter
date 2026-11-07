// src/featureGate/checks/openSwitch.test.ts
// 全開スイッチ FEATURE_GATE_OPEN と判定の入口の回帰テスト:
// - 値: 未設定 = 規則の値のまま / all = 全開 / 名前の並び = その名前だけ開く / 未知の名前 = throw
// - 効く条件: APP_ENV が development なら全 Tier、staging・production・値なし・知らない値は Tier1 だけ
// - Tier1 の判別: 注入 FEATURE_GATE_TIER1 があればそれ、無ければ readForkIdentity().isTier1
// - 入口: 門番の中で生成一覧 extensions/rules を値で読むのも、規則の .enabled() を直に呼ぶのも ruleList.ts だけ(字面の検査、テストは除く)
// - next.config.ts の FEATURE_GATE_TIER1 = readForkIdentity(repoRoot).isTier1
// 閉じた状態は生成一覧の規則の enabled を一時的に差し替えて作る(config の値に依らない)。実行: pnpm test:feature-gate:tools

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { test } from "node:test";

import { clientGateState, gate, type GatedFeatureRule } from "@/featureGate";
import { rules as generatedRules } from "@/featureGate/extensions/rules";
import { closedTables, rules } from "@/featureGate/node";
import { isOpenSwitchActive, isTier1Build, parseOpenSwitch, resolveOpenSwitch } from "@/featureGate/openSwitch";
import { configEnabled } from "@/featureGate/ruleList";
import { setAppEnv } from "@/lib/appEnv";
import { readForkIdentity } from "@/lib/forkOwnership/forkIds.mjs";

const repoRoot = resolve(__dirname, "../../..");
const known = new Set(generatedRules.map((rule) => rule.name));
const SWITCH_KEYS = ["FEATURE_GATE_OPEN", "FEATURE_GATE_TIER1"] as const;
type SwitchEnv = Partial<Record<(typeof SWITCH_KEYS)[number] | "APP_ENV", string>>;

/** env を一時的に差し替え(APP_ENV は @/lib/appEnv の setAppEnv)、生成一覧の規則を全部閉じて fn を走らせる(終われば戻す) */
function withEnv(env: SwitchEnv, fn: () => void) {
  const savedEnv = new Map(SWITCH_KEYS.map((key) => [key, process.env[key]]));
  const savedRules = new Map<GatedFeatureRule, GatedFeatureRule["enabled"]>();
  for (const rule of generatedRules) {
    savedRules.set(rule, rule.enabled);
    rule.enabled = () => false;
  }
  for (const key of SWITCH_KEYS) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  const restoreAppEnv = setAppEnv(env.APP_ENV);
  try {
    fn();
  } finally {
    restoreAppEnv();
    for (const [key, value] of savedEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    for (const [rule, enabled] of savedRules) rule.enabled = enabled;
  }
}

const openNames = () => rules.filter((rule) => gate.enabled(rule.name)).map((rule) => rule.name);

test("値の読み: 空 = なし / all / 名前の並び(, と空白)/ 未知の名前は throw", () => {
  assert.equal(parseOpenSwitch(undefined, known), null);
  assert.equal(parseOpenSwitch("  ", known), null);
  assert.equal(parseOpenSwitch("all", known), "all");
  assert.deepEqual(parseOpenSwitch("coupon, wallet", known), new Set(["coupon", "wallet"]));
  assert.throws(() => parseOpenSwitch("coupon,noSuchFeature", known), /FEATURE_GATE_OPEN に未知の機能の名前 "noSuchFeature"/);
});

test("効く条件: development は全 Tier、staging・production・値なし・知らない値は Tier1 だけ(効かなければ値を読まない)", () => {
  assert.equal(isOpenSwitchActive({ appEnv: "development", tier1: false }), true);
  assert.equal(isOpenSwitchActive({ appEnv: "development", tier1: true }), true);
  for (const appEnv of ["staging", "production"] as const) {
    assert.equal(isOpenSwitchActive({ appEnv, tier1: true }), true, `${appEnv} Tier1`);
    assert.equal(isOpenSwitchActive({ appEnv, tier1: false }), false, `${appEnv} fork`);
  }
  assert.equal(resolveOpenSwitch({ open: "noSuchFeature", appEnv: "production", tier1: false }, known), null);
  assert.throws(() => resolveOpenSwitch({ open: "noSuchFeature", appEnv: "production", tier1: true }, known), /未知の機能の名前/);
});

test("Tier1 の判別: 注入があればそれ、無ければ node の入口が渡した readForkIdentity().isTier1", () => {
  withEnv({ FEATURE_GATE_TIER1: "true" }, () => assert.equal(isTier1Build(), true));
  withEnv({ FEATURE_GATE_TIER1: "false" }, () => assert.equal(isTier1Build(), false));
  withEnv({}, () => assert.equal(isTier1Build(), readForkIdentity(process.cwd()).isTier1));
});

test("未設定: 規則の値のまま(全部閉じた規則は閉じたまま)", () => {
  withEnv({}, () => {
    assert.deepEqual(openNames(), []);
    const wallet = rules.find((rule) => rule.name === "wallet");
    assert.ok(wallet && wallet.pathPatterns.length > 0);
    assert.equal(gate.path(wallet.pathPatterns[0].replace(/^=/, "")).open, false);
  });
});

test("all: 全開(gate・clientGateState・closedTables が揃う)", () => {
  withEnv({ FEATURE_GATE_OPEN: "all", APP_ENV: "development" }, () => {
    assert.deepEqual(openNames(), rules.map((rule) => rule.name));
    const state = clientGateState("admin");
    assert.ok(Object.values(state.enabled).every(Boolean));
    assert.deepEqual(state.closed, []);
    assert.deepEqual(closedTables(rules), []);
    for (const rule of rules) assert.equal(configEnabled(rule.name), false, `${rule.name}: 規則の値はスイッチを通さない`);
  });
});

test("名前の並び: 名前の物だけ開く / 未知の名前は判定で throw", () => {
  withEnv({ FEATURE_GATE_OPEN: "coupon,wallet", APP_ENV: "development" }, () => {
    assert.deepEqual(openNames().sort(), ["coupon", "wallet"]);
    assert.equal(clientGateState("user").enabled.wallet, true);
    assert.equal(clientGateState("user").enabled.referral, false);
  });
  withEnv({ FEATURE_GATE_OPEN: "wallet,noSuchFeature", APP_ENV: "development" }, () => {
    assert.throws(() => gate.enabled("wallet"), /FEATURE_GATE_OPEN に未知の機能の名前 "noSuchFeature"/);
  });
});

test("段階と Tier: development は fork でも効き、staging・production・値なし・env ファイルの名前は Tier1 だけ", () => {
  for (const APP_ENV of ["staging", "production", undefined, ".env.production"]) {
    withEnv({ FEATURE_GATE_OPEN: "all", APP_ENV, FEATURE_GATE_TIER1: "true" }, () => {
      assert.deepEqual(openNames(), rules.map((rule) => rule.name), `${APP_ENV} Tier1`);
    });
    withEnv({ FEATURE_GATE_OPEN: "all", APP_ENV, FEATURE_GATE_TIER1: "false" }, () => {
      assert.deepEqual(openNames(), [], `${APP_ENV} fork`);
    });
  }
  withEnv({ FEATURE_GATE_OPEN: "noSuchFeature", APP_ENV: "production", FEATURE_GATE_TIER1: "false" }, () => {
    assert.deepEqual(openNames(), [], "fork の本番では未知の名前でも落とさない");
  });
  withEnv({ FEATURE_GATE_OPEN: "wallet", APP_ENV: "development", FEATURE_GATE_TIER1: "false" }, () => {
    assert.deepEqual(openNames(), ["wallet"], "fork でも development では効く");
  });
});

// ---- 判定の入口の字面の検査(門番の中だけ。テストは除く) ----

const GATE_DIR = join(repoRoot, "src/featureGate");
const ENTRY = "src/featureGate/ruleList.ts";
const SOURCE = /\.(ts|tsx|mts|mjs)$/;
const TEST = /\.test\.[cm]?[jt]sx?$/;

function gateSources(dir = GATE_DIR, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (path !== join(GATE_DIR, "extensions")) gateSources(path, out);
    } else if (SOURCE.test(name) && !TEST.test(name)) out.push(relative(repoRoot, path).split(sep).join("/"));
  }
  return out;
}

const VALUE_IMPORT_OF_RULES = /^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s*["'](?:\.{1,2}\/)+(?:featureGate\/)?extensions\/rules["']|^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s*["']@\/featureGate\/extensions\/rules["']/m;
const DIRECT_ENABLED_CALL = /\.enabled\(\s*\)/;

test("入口: 門番の中で生成一覧 extensions/rules を値で読むのは ruleList.ts だけ", () => {
  const offenders = gateSources().filter((rel) => rel !== ENTRY && VALUE_IMPORT_OF_RULES.test(readFileSync(join(repoRoot, rel), "utf8")));
  assert.deepEqual(offenders, [], "判定は ruleList.ts の rules / ruleEnabled を通す");
  assert.match(readFileSync(join(repoRoot, ENTRY), "utf8"), VALUE_IMPORT_OF_RULES);
});

test("入口: 門番の中で規則の .enabled() を直に呼ぶのは ruleList.ts だけ(規則のファイルの定義 enabled: () => は対象外)", () => {
  const offenders = gateSources().filter((rel) => rel !== ENTRY && DIRECT_ENABLED_CALL.test(readFileSync(join(repoRoot, rel), "utf8")));
  assert.deepEqual(offenders, [], "ruleEnabled(rule) を呼ぶ");
  // 検査が効いていること: 直呼びの字面を拾う / 定義と gate.enabled("x") は拾わない
  assert.ok(DIRECT_ENABLED_CALL.test("rules.filter((rule) => !rule.enabled())"));
  assert.ok(!DIRECT_ENABLED_CALL.test('enabled: () => APP_FEATURES.x.enabled, gate.enabled("wallet")'));
  assert.ok(VALUE_IMPORT_OF_RULES.test('import { rules } from "./extensions/rules";'));
  assert.ok(VALUE_IMPORT_OF_RULES.test('export { rules } from "../extensions/rules";'));
  assert.ok(!VALUE_IMPORT_OF_RULES.test('import type { FeatureName } from "./extensions/rules";'));
});

test("next.config.ts: FEATURE_GATE_TIER1 を build 時に fork_id から計算して env に inline する", async () => {
  const config = (await import("../../../next.config")) as {
    featureGateTier1: string;
    default: { env?: Record<string, string> };
  };
  const expected = String(readForkIdentity(repoRoot).isTier1);
  assert.equal(config.featureGateTier1, expected);
  assert.equal(config.default.env?.FEATURE_GATE_TIER1, expected);
});
