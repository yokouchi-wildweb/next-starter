// scripts/structure/proxies/openSwitch.test.ts
// 全開スイッチ FEATURE_GATE_OPEN と判定の入口の回帰テスト:
// - 値: 未設定 = 規則の値のまま / all = 全開 / 名前の並び = その名前だけ開く / 未知の名前 = throw
// - 効く条件: APP_ENV が development なら全 Tier、staging・production・値なし・知らない値は Tier1 だけ
// - Tier1 の判別: 注入 FEATURE_GATE_TIER1 があればそれ、無ければ readForkIdentity().isTier1
// - 依存(dependsOn): 判定は ruleList.ts の 1 か所で依存先まで解く(rules・configRules の両方)。名前指定のスイッチは依存先を開けず、
//   足りない名前を値ごとに 1 回 console.warn し pnpm ops features list に出す(D34・L3.1)
// - 入口: 門番の中で生成一覧 extensions/rules を値で読むのも、規則の .enabled() を直に呼ぶのも ruleList.ts だけ(字面の検査、テストは除く)
// - next.config.ts の FEATURE_GATE_TIER1 = readForkIdentity(repoRoot).isTier1
// - 効く範囲(L2.3): 効かせる = 門番の口・useGate・db:push / db:push:check の表・seed・pnpm ops db clear・pnpm ops features list の開閉 /
//   効かせない(規則の値) = pnpm generate cron / pnpm check cron・pnpm generate routes・FEATURE_GATE_CHECK の検査・codemod(pnpm ops features set と required/ は config を書く道具で開閉を読まない)
// 閉じた状態は生成一覧の規則の enabled を一時的に差し替えて作る(config の値に依らない)。実行: pnpm test scripts/structure/proxies/openSwitch.test.ts(src から scripts を読めないので、道具の配線も見るこのテストは scripts/ の側に置く)

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { test } from "node:test";

import { clientGateState, gate, type GeneratedFeatureRule } from "@/featureGate";
import { rules as generatedRules } from "@/featureGate/extensions/rules";
import { closedTables, configPath, configRules, gate as nodeGate, readFeatureReport, rules, switchMissingDependencies } from "@/featureGate/node";
import { isOpenSwitchActive, isTier1Build, parseOpenSwitch, resolveOpenSwitch } from "@/featureGate/openSwitch";
import { configEnabled } from "@/featureGate/ruleList";
import { setAppEnv } from "@/lib/appEnv";
import { readForkIdentity } from "@/lib/forkOwnership/forkIds.mjs";

import { gateClosedBy } from "../cron/discover";

const repoRoot = resolve(__dirname, "../../..");
const known = new Set(generatedRules.map((rule) => rule.name));
const SWITCH_KEYS = ["FEATURE_GATE_OPEN", "FEATURE_GATE_TIER1"] as const;
type SwitchEnv = Partial<Record<(typeof SWITCH_KEYS)[number] | "APP_ENV", string>>;

/** env を一時的に差し替え(APP_ENV は @/lib/appEnv の setAppEnv)、生成一覧の規則を全部閉じて fn を走らせる(終われば戻す) */
function withEnv(env: SwitchEnv, fn: () => void) {
  const savedEnv = new Map(SWITCH_KEYS.map((key) => [key, process.env[key]]));
  const savedRules = new Map<GeneratedFeatureRule, GeneratedFeatureRule["enabled"]>();
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

// ---- 依存(dependsOn、D24・D34) ----

const generatedOf = (name: string) => generatedRules.find((rule) => rule.name === name)!;

/** 生成一覧の規則の dependsOn と enabled を一時的に差し替えて fn を走らせる(withEnv の中で使う。終われば戻す) */
function withDeps(deps: Record<string, string[]>, open: Record<string, boolean | undefined>, fn: () => void) {
  const saved = new Map<GeneratedFeatureRule, Pick<GeneratedFeatureRule, "dependsOn" | "enabled">>();
  for (const name of new Set([...Object.keys(deps), ...Object.keys(open)])) {
    const rule = generatedOf(name);
    saved.set(rule, { dependsOn: rule.dependsOn, enabled: rule.enabled });
    if (deps[name]) rule.dependsOn = deps[name] as GeneratedFeatureRule["dependsOn"];
    if (name in open) {
      const value = open[name];
      rule.enabled = value === undefined ? undefined : () => value;
    }
  }
  try {
    fn();
  } finally {
    for (const [rule, value] of saved) Object.assign(rule, value);
  }
}

test("依存: 上流の規則はまだ dependsOn を書かない(開閉の答えは今と同じ)", () => {
  assert.deepEqual(generatedRules.filter((rule) => rule.dependsOn.length > 0).map((rule) => rule.name), []);
});

test("依存: 親が閉 → 子・孫が閉(rules と configRules の両方)、enabled 省略の子は依存先しだい", () => {
  withEnv({}, () => {
    // wallet ← referral ← coupon、wallet ← payment(enabled 省略)
    withDeps({ referral: ["wallet"], coupon: ["referral"], payment: ["wallet"] }, { wallet: false, referral: true, coupon: true, payment: undefined }, () => {
      for (const list of [rules, configRules]) {
        const open = (name: string) => list.find((rule) => rule.name === name)!.enabled();
        assert.deepEqual(["wallet", "referral", "coupon", "payment"].map(open), [false, false, false, false]);
      }
      assert.equal(gate.enabled("coupon"), false);
      assert.equal(gate.path("/admin/coupons").open, false, "閉じた孫の住所は閉");
      assert.equal(configEnabled("coupon"), false);
    });
    withDeps({ referral: ["wallet"], coupon: ["referral"], payment: ["wallet"] }, { wallet: true, referral: true, coupon: true, payment: undefined }, () => {
      assert.deepEqual(["wallet", "referral", "coupon", "payment"].map((name) => gate.enabled(name as never)), [true, true, true, true]);
      assert.equal(clientGateState("user").enabled.payment, true, "enabled 省略 = 自分は開");
    });
  });
});

test("依存: 全開スイッチの名前指定は依存先を開けない(足りない名前を値ごとに 1 回 console.warn、features list に出す)", async () => {
  const warned: string[] = [];
  const savedWarn = console.warn;
  console.warn = (message: string) => void warned.push(message);
  try {
    withEnv({ FEATURE_GATE_OPEN: "coupon", APP_ENV: "development" }, () => {
      withDeps({ coupon: ["referral"], referral: ["wallet"] }, {}, () => {
        assert.equal(gate.enabled("coupon"), false, "依存先 referral・wallet が閉なので閉のまま");
        assert.equal(gate.enabled("coupon"), false);
        assert.equal(clientGateState("user").enabled.coupon, false);
        assert.deepEqual(switchMissingDependencies(), { coupon: ["referral", "wallet"] });
        assert.equal(warned.length, 1, "同じ値では 1 回だけ");
        assert.match(warned[0], /FEATURE_GATE_OPEN で開けた機能の依存先が閉じているため閉のまま.*coupon ← referral, wallet/);
      });
    });
    withEnv({ FEATURE_GATE_OPEN: "coupon,referral,wallet", APP_ENV: "development" }, () => {
      withDeps({ coupon: ["referral"], referral: ["wallet"] }, {}, () => {
        assert.equal(gate.enabled("coupon"), true, "依存先も名前に足せば開く");
        assert.deepEqual(switchMissingDependencies(), {});
      });
    });
    assert.equal(warned.length, 1, "足りない名前の無い値では warn しない");
    // pnpm ops features list(readFeatureReport)にも足りない名前が出る。全部閉じた状態は withEnv の外で作る
    const restore = setAppEnv("development");
    const saved = process.env.FEATURE_GATE_OPEN;
    process.env.FEATURE_GATE_OPEN = "coupon";
    const savedRules = generatedRules.map((rule) => [rule, rule.enabled] as const);
    for (const rule of generatedRules) rule.enabled = () => false;
    // 評価は生成一覧の dependsOn を読み、説明は渡した一覧(rules。読み込み時の写し)の dependsOn を読むので両方を差し替える
    const coupon = generatedOf("coupon");
    const wrapped = rules.find((rule) => rule.name === "coupon")!;
    const savedDeps = coupon.dependsOn;
    coupon.dependsOn = ["wallet"];
    wrapped.dependsOn = ["wallet"];
    try {
      const report = await readFeatureReport(repoRoot, rules);
      const row = report.find((d) => d.name === "coupon")!;
      assert.deepEqual([row.enabled, row.openedBySwitch, row.switchMissing, row.closedBy], [false, true, ["wallet"], { self: false, dependencies: ["wallet"] }]);
    } finally {
      coupon.dependsOn = savedDeps;
      wrapped.dependsOn = savedDeps;
      for (const [rule, enabled] of savedRules) rule.enabled = enabled;
      if (saved === undefined) delete process.env.FEATURE_GATE_OPEN;
      else process.env.FEATURE_GATE_OPEN = saved;
      restore();
    }
  } finally {
    console.warn = savedWarn;
  }
});

// ---- 効く範囲(L2.3) ----

test("範囲: 効かせない道具は規則の値で見る(configRules・configPath・cron の gateClosedBy はスイッチで揺れない)", () => {
  withEnv({ FEATURE_GATE_OPEN: "all", APP_ENV: "development" }, () => {
    assert.ok(configRules.every((rule) => !rule.enabled()), "configRules はスイッチを通さない");
    const wallet = configRules.find((rule) => rule.name === "wallet");
    assert.ok(wallet);
    const pathname = wallet.pathPatterns[0].replace(/^=/, "");
    assert.deepEqual(configPath(pathname), { open: false, rule: "wallet", redirectTo: wallet.redirectTo });
    assert.equal(gate.path(pathname).open, true, "門番の口は開く");
    assert.equal(gateClosedBy(pathname), "wallet", "pnpm generate cron / pnpm check cron は規則の値");
    // 導出の住所(汎用 API・cron)もドメインの開閉で同じく答える(規則の値)
    assert.deepEqual(configPath("/api/wallet"), { open: false, rule: "wallet", redirectTo: wallet.redirectTo });
    assert.equal(gateClosedBy("/api/cron/wallet-lots-prune"), "wallet");
    assert.equal(gate.path("/api/cron/wallet-lots-prune").open, true, "門番の口はスイッチで開く");
  });
});

test("範囲: 効かせる道具はスイッチで開いた機能を開とみなす(rules・closedTables・node の gate)", () => {
  withEnv({ FEATURE_GATE_OPEN: "wallet", APP_ENV: "development" }, () => {
    assert.equal(nodeGate.enabled("wallet"), true, "seed は node の gate.enabled で見る");
    const tables = closedTables(rules);
    for (const table of rules.find((rule) => rule.name === "wallet")?.tables ?? []) assert.ok(!tables.includes(table), `${table} は db:push の対象`);
    assert.ok(closedTables(configRules).includes("wallets"), "規則の値では閉じたまま");
  });
});

const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

test("範囲: 読み手がどちらの一覧を読むか(字面)", () => {
  assert.match(read("scripts/structure/routes/map.mjs"), /import \{ configRules as featureGateRules \} from "\.\.\/\.\.\/\.\.\/src\/featureGate\/node\.ts"/);
  assert.match(read("scripts/structure/proxies/featureGate.test.mjs"), /const featureGateRules = withCoveredPatterns\(configRules\)/);
  assert.match(read("scripts/structure/cron/discover.ts"), /import \{ configPath \} from "@\/featureGate\/node"/);
  assert.match(read(".notices/20261105-112509-feature-gate-automation.feature-gate-s3.mjs"), /node\.configRules \?\? node\.rules/);
  for (const rel of ["scripts/operations/db/push.ts", "scripts/operations/db/check-schema-roundtrip.ts"]) {
    assert.match(read(rel), /\{ rules, gatedSchema \}/, `${rel}: 表はスイッチを通した rules で外す`);
  }
  assert.match(read("scripts/operations/db/clear.ts"), /closedTables\(gateNode\.rules\)/);
  assert.match(read("scripts/runner/seed/run.ts"), /const \{ rules \} = await import\("@\/featureGate\/node"\)[\s\S]*closedByOf\(rules\)/, "シードはスイッチを通した rules で閉じたドメインを飛ばす");
});

test("pnpm ops features list: 規則の値とスイッチを分けて出す(configEnabled・openedBySwitch)", async () => {
  const wallet = rules.filter((rule) => rule.name === "wallet");
  let report: Awaited<ReturnType<typeof readFeatureReport>> = [];
  const restore = setAppEnv("development");
  const saved = process.env.FEATURE_GATE_OPEN;
  const savedEnabled = generatedRules.find((rule) => rule.name === "wallet")!.enabled;
  generatedRules.find((rule) => rule.name === "wallet")!.enabled = () => false;
  process.env.FEATURE_GATE_OPEN = "wallet";
  try {
    report = await readFeatureReport(repoRoot, wallet);
  } finally {
    generatedRules.find((rule) => rule.name === "wallet")!.enabled = savedEnabled;
    if (saved === undefined) delete process.env.FEATURE_GATE_OPEN;
    else process.env.FEATURE_GATE_OPEN = saved;
    restore();
  }
  assert.equal(report.length, 1);
  assert.deepEqual([report[0].enabled, report[0].configEnabled, report[0].openedBySwitch], [true, false, true]);
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
