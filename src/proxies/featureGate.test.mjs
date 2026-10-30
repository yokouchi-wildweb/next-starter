// Feature Gate（ルートゲート + スキーマゲート）の規律テスト。
// 実行: pnpm test:feature-gate (node:test + tsx。config / registry の .ts を読むため tsx ランナーを使う)
//
// 定義: src/proxies/featureGateRules/<名前>[.<fork ID>].ts(一覧 src/proxies/extensions/featureGateRules.ts)/ 設計: src/proxies/README.md
//
// 検査の対象は「今 enabled: false のルール」だけ。有効な機能のルートは開いていて正しく、
// 機能を切ったときに初めて「テーブルが無いのに開いているルート」が問題になるため。
// upstream は全機能が有効なので、ゲート対象ドメインを触るときは FEATURE_GATE_CHECK=all で全ルールを無効とみなして検査する:
//   FEATURE_GATE_CHECK=all pnpm test:feature-gate
//
// 守りたい契約:
// 1. features のフォルダから導いた表名(生成一覧の tables)は schemaRegistry に実在する
// 2. 無効なルールのドメイン（そのテーブルを entities/drizzle.ts で定義するドメイン）を
//    import するルート（route.ts / page.tsx と、その _screen/ _components/ 配下）は、そのルールの pathPatterns で閉じている
//    （新しいルートを足して定義に書き忘れると失敗する）。意図的に閉じないルートは ROUTE_EXCEPTIONS に理由付きで書く（upstream 用）
// 3. 同じドメインの汎用 CRUD（/api/<domain>）も閉じている（汎用 CRUD が全操作 "none" の INTERNAL_ONLY の行は対象外）
// 4. 現在のフラグの組み合わせでスキーマゲートが成立する（外すテーブルを残すテーブルが外部キーで参照しない）
//    外部キーに現れない機能間の前提（紹介 → クーポン）も満たす
// 5. スキーマゲートは enum を外さず、無効なテーブルだけを両側（imports / tablesFilter）から外す
// 7. 常時実行の入口(cron の task.ts・後片付けと照合の登録表・常に読み込まれる結線)が表を持つ規則の機能のフォルダを
//    import するなら閉じられる(D17・D30・D20 K4。判定は scripts/proxies/alwaysOnEntries.mjs)。全規則を無効とみなして見る
// 6. 行き先(redirectTo)の違う規則の住所の重なり(L1.22): 上流の規則どうしは失敗、fork の規則と上流の重なりは表示だけ
//    (判定はファイル名の順で最初の無効な規則の行き先)。一覧は規則ファイルと同じ並び
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { getTableName, is } from "drizzle-orm";
import { isPgEnum, PgTable } from "drizzle-orm/pg-core";

import { serviceRegistry } from "../registry/serviceRegistry.ts";
import { isGenericApiClosed } from "../lib/domain/config/apiAccess.ts";
import { APP_FEATURES } from "../config/app/app-features.config.ts";
import { featureGateRules } from "./extensions/featureGateRules.ts";
import { parseForkDotName, readDeclaredForkIds } from "../lib/forkOwnership/forkIds.mjs";
import { discoverGateRules } from "../../scripts/proxies/extensions.mjs";
import { judgeAlwaysOnEntries, readForkAlwaysOn, FORK_ALWAYS_ON_PREFIX } from "../../scripts/proxies/alwaysOnEntries.mjs";
import { applySchemaGate } from "../../scripts/registry/schemaGate.ts";
import { matchesPath, patternCoversRoute } from "./pathPattern.mjs";

// schemaRegistry は `export *` の再 export だけで構成されるため、ESM の namespace import では
// 名前を拾えない（CJS として読まれ default しか見えない）。db:push と同じく require で全 export を得る
const schema = createRequire(import.meta.url)("../registry/schemaRegistry.ts");

const ROOT = resolve(import.meta.dirname, "../..");
const APP_DIR = join(ROOT, "src/app");
const FEATURES_DIR = join(ROOT, "src/features");

// 対象ドメインを import するが、意図的にゲートで閉じないルート（src/app 相対 → 理由）。upstream のルート用
const ROUTE_EXCEPTIONS = {};

// FEATURE_GATE_CHECK=all: 全ルールを無効とみなして検査する（upstream 用）
const CHECK_ALL = process.env.FEATURE_GATE_CHECK === "all";
const CHECK_ALL_ONLY = "FEATURE_GATE_CHECK=all のときだけ実行（upstream 用）";

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};

// テーブル名 → それを定義するドメイン名（src/features/<domain> または src/features/core/<domain>）
const tableOwnerDomains = () => {
  const owners = new Map();
  for (const file of walk(FEATURES_DIR).filter((f) => f.endsWith(`${sep}entities${sep}drizzle.ts`))) {
    const parts = relative(FEATURES_DIR, file).split(sep);
    const domain = parts[0] === "core" ? parts[1] : parts[0];
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/pgTable\(\s*["']([^"']+)["']/g)) {
      owners.set(match[1], domain);
    }
  }
  return owners;
};

// src/app 配下のファイルパス → それが属するルートの URL セグメント
// （ルートグループは除き、private フォルダ（_screen / _components 等）以降は切り捨て、動的セグメントは "[x]" のまま）
const toUrlSegments = (file) => {
  const dirs = relative(APP_DIR, file).split(sep).slice(0, -1);
  const privateIndex = dirs.findIndex((seg) => seg.startsWith("_"));
  return (privateIndex === -1 ? dirs : dirs.slice(0, privateIndex)).filter(
    (seg) => !(seg.startsWith("(") && seg.endsWith(")")),
  );
};

// パターンがルートを覆うか(完全一致の `=` も含む)は proxy と同じ ./pathPattern.mjs

const rulesWithTables = featureGateRules.filter((rule) => (rule.tables ?? []).length > 0);
// ルートの被覆を検査するルール（無効なもの。CHECK_ALL なら全部）
const checkedRules = rulesWithTables.filter((rule) => CHECK_ALL || !rule.enabled());
const schemaTableNames = new Set(
  Object.values(schema)
    .filter((value) => is(value, PgTable))
    .map((table) => getTableName(table)),
);

test("パターン: 前方一致はセグメント境界、= は完全一致(fork が下に足したページを巻き込まない)", () => {
  assert.equal(matchesPath("/demo/x", "/demo"), true);
  assert.equal(matchesPath("/demo-login", "/demo"), false);
  assert.equal(matchesPath("/demo", "/demo/"), true);
  assert.equal(matchesPath("/mypage", "=/mypage"), true);
  assert.equal(matchesPath("/mypage/mine", "=/mypage"), false);
  assert.equal(patternCoversRoute("=/mypage/account", ["mypage", "account"]), true);
  assert.equal(patternCoversRoute("=/mypage/account", ["mypage", "account", "mine"]), false);
  assert.equal(patternCoversRoute("/wallet", ["wallet", "[slug]"]), true);
});

test("upstream の画面を止めるスイッチ: 各規則のパターンが実在のページに当たる(書き違い・ページの移動の検出)", () => {
  const pages = walk(APP_DIR)
    .filter((f) => /[\\/]page\.tsx$/.test(f))
    .map((f) => toUrlSegments(f));
  const switchRules = featureGateRules.filter((rule) => rule.pathPatterns.some((pattern) => pattern.startsWith("=")));
  const stale = switchRules
    .flatMap((rule) => rule.pathPatterns)
    .filter((pattern) => !pattern.startsWith("/api/") && !pages.some((segments) => patternCoversRoute(pattern, segments)));
  assert.deepEqual(stale, [], `ページの無いパターン: ${stale.join(", ")}`);
});

test("features から導いた表名は schemaRegistry に実在する(導出は proxy:generate、走査の一致は test:schema-registry)", () => {
  const unknown = rulesWithTables.flatMap((rule) => rule.tables.filter((name) => !schemaTableNames.has(name)));
  assert.deepEqual(unknown, [], `schemaRegistry に無いテーブル名: ${unknown.join(", ")}`);
});

test("無効な機能のドメインを import するルートは、そのドメインのルールで閉じている", () => {
  const owners = tableOwnerDomains();
  // route.ts / page.tsx だけでなく、そのルートの Screen / loader / 部品（_screen/ _components/）も見る
  const routeFiles = walk(APP_DIR).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f));
  const problems = [];

  for (const rule of checkedRules) {
    const domains = new Set(rule.tables.map((name) => owners.get(name)).filter(Boolean));
    for (const file of routeFiles) {
      const rel = relative(APP_DIR, file).split(sep).join("/");
      if (rel in ROUTE_EXCEPTIONS) continue;
      const source = readFileSync(file, "utf8");
      const imported = [...domains].filter((domain) =>
        new RegExp(`["']@/features/(core/)?${domain}/`).test(source),
      );
      if (imported.length === 0) continue;
      const segments = toUrlSegments(file);
      if (!rule.pathPatterns.some((pattern) => patternCoversRoute(pattern, segments))) {
        problems.push(`${rel}（${imported.join(", ")} を import）が「${rule.tables.join(", ")}」のルールで閉じていない`);
      }
    }
  }
  assert.deepEqual(problems, [], `pathPatterns に追加するか ROUTE_EXCEPTIONS に理由付きで書く:\n${problems.join("\n")}`);
});

test("無効な機能のドメインの汎用 CRUD（/api/<domain>）は閉じている", () => {
  const owners = tableOwnerDomains();
  const problems = [];
  for (const rule of checkedRules) {
    for (const name of rule.tables) {
      const domain = owners.get(name);
      if (!domain || !(domain in serviceRegistry)) continue;
      // 汎用 CRUD が全操作 "none"（INTERNAL_ONLY）の行は /api/<domain> が存在しない（404）ので対象外
      if (isGenericApiClosed(serviceRegistry[domain].access)) continue;
      if (!rule.pathPatterns.some((pattern) => patternCoversRoute(pattern, ["api", domain]))) {
        problems.push(`/api/${domain}`);
      }
    }
  }
  assert.deepEqual(problems, [], `pathPatterns に追加する: ${problems.join(", ")}`);
});

test("ROUTE_EXCEPTIONS の各行は実在するルート", () => {
  const missing = Object.keys(ROUTE_EXCEPTIONS).filter((rel) => {
    try {
      readFileSync(join(APP_DIR, rel));
      return false;
    } catch {
      return true;
    }
  });
  assert.deepEqual(missing, [], `存在しないルートの例外行: ${missing.join(", ")}`);
});

test("現在のフラグの組み合わせでスキーマゲートが成立する", () => {
  assert.doesNotThrow(() => applySchemaGate(schema, featureGateRules));
});

test("紹介機能はクーポン機能を前提にする（招待コードの実体はクーポン）", () => {
  assert.ok(
    !APP_FEATURES.marketing.referral.enabled || APP_FEATURES.marketing.coupon.enabled,
    "marketing.referral.enabled=true のときは marketing.coupon.enabled も true にする",
  );
});

test("全機能を無効にしてもスキーマゲートが成立する（外部キーが無効な機能の外へ出ていない）", { skip: !CHECK_ALL && CHECK_ALL_ONLY }, () => {
  const allDisabled = featureGateRules.map((rule) => ({ ...rule, enabled: () => false }));
  assert.doesNotThrow(() => applySchemaGate(schema, allDisabled));
});

test("スキーマゲートは無効なテーブルを両側から外し、enum は残す", { skip: !CHECK_ALL && CHECK_ALL_ONLY }, () => {
  const rules = featureGateRules.map((rule) => ({ ...rule, enabled: () => false }));
  const gate = applySchemaGate(schema, rules);
  const gatedNames = rules.flatMap((rule) => rule.tables ?? []);

  const keptTables = Object.values(gate.imports)
    .filter((value) => is(value, PgTable))
    .map((table) => getTableName(table));
  assert.deepEqual(keptTables.filter((name) => gatedNames.includes(name)), []);
  assert.deepEqual([...gate.tablesFilter].sort(), gatedNames.map((name) => `!${name}`).sort());

  const enumCount = (exports) => Object.values(exports).filter((value) => isPgEnum(value)).length;
  assert.equal(enumCount(gate.imports), enumCount(schema));
});

test("全機能が有効ならスキーマゲートは何も外さない", () => {
  const rules = featureGateRules.map((rule) => ({ ...rule, enabled: () => true }));
  const gate = applySchemaGate(schema, rules);
  assert.equal(gate.tablesFilter, undefined);
  assert.equal(Object.keys(gate.imports).length, Object.keys(schema).length);
});

test("payment だけ有効で wallet が無効な組み合わせは外部キーで拒否される", () => {
  const rules = featureGateRules.map((rule) => ({
    ...rule,
    enabled: () => !(rule.tables ?? []).includes("wallets"),
  }));
  assert.throws(() => applySchemaGate(schema, rules), /purchase_requests → wallet_histories/);
});

// 住所の重なり: どちらかの住所(= を外した形)が相手のパターンに当たれば重なる
const patternPath = (pattern) => (pattern.startsWith("=") ? pattern.slice(1) : pattern);
const overlaps = (a, b) => matchesPath(patternPath(a), b) || matchesPath(patternPath(b), a);

test("一覧は規則ファイルと同じ並び・同じ数(proxy:generate のずれは proxy:check でも止まる)", () => {
  const { all } = readDeclaredForkIds(ROOT);
  const { rules, problems } = discoverGateRules(ROOT, all);
  assert.deepEqual(problems, []);
  assert.equal(rules.length, featureGateRules.length);
  for (const rule of featureGateRules) assert.equal(typeof rule.enabled, "function");
});

test("行き先の違う規則の住所の重なり(L1.22): 上流どうしは不可、fork と上流は表示だけ", () => {
  const { all } = readDeclaredForkIds(ROOT);
  const { rules: files } = discoverGateRules(ROOT, all);
  const entries = featureGateRules.map((rule, i) => ({ rule, file: files[i].file, fork: files[i].forkId !== null }));
  const upstreamConflicts = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i];
      const b = entries[j];
      if ((a.rule.redirectTo ?? null) === (b.rule.redirectTo ?? null)) continue;
      const hit = a.rule.pathPatterns.flatMap((p) => b.rule.pathPatterns.filter((q) => overlaps(p, q)).map((q) => `${p} × ${q}`));
      if (hit.length === 0) continue;
      const line = `${a.file}(${a.rule.redirectTo ?? "404"})と ${b.file}(${b.rule.redirectTo ?? "404"}): ${hit.join(", ")}`;
      if (a.fork || b.fork) console.log(`[feature-gate] 行き先の違う重なり(fork、先の規則が優先): ${line}`);
      else upstreamConflicts.push(line);
    }
  }
  assert.deepEqual(upstreamConflicts, [], `上流の規則どうしで行き先の違う重なり:\n${upstreamConflicts.join("\n")}`);
});

// 常時実行の入口の閉じ漏れ(D17・D30・D20 K4)
// 後片付け・照合の登録表(定期実行・退会処理から常に読まれる)。それ以外の src/registry は画面・サービスから読まれるか表を読まない
const ALWAYS_ON_REGISTRIES = [
  "src/registry/userCleanupRegistry.ts", // 退会・ソフトデリートの後片付け(executeCleanup)
  "src/registry/coinIssuanceRegistry.ts", // コイン創出の照合(管理の集計 API)
  "src/registry/analyticsRollupRegistry.ts", // 日次の集計(cron analytics-rollup-daily)
];
// 常に読み込まれる結線のうち、表を持つ機能のフォルダを import してよいもの(path → 理由)。縮む表。
// fork の分は scripts/proxies/alwaysOnExceptions.<fork ID>.mjs に理由つきで(L1.24。ここは編集しない)
const ALWAYS_ON_EXCEPTIONS = {
  "src/wiring/apiRoute.ts":
    "pairedDevice の apiRouteDeviceDeps を Factory に結ぶだけ。端末の解決(表の読み取り)は createDeviceRoute の route が呼ばれたときだけ走り、その route は pairedDevice の規則で閉じる",
};

test("常時実行の入口: 表を持つ規則の機能を import するなら閉じられる(cron は enabled、登録表は条件つき spread、結線は例外表)", async () => {
  const { all: forkIds } = readDeclaredForkIds(ROOT);
  const forkFiles = readdirSync(join(ROOT, "scripts/proxies"))
    .filter((name) => name.startsWith(`${FORK_ALWAYS_ON_PREFIX}.`))
    .map((name) => ({ name, load: () => import(pathToFileURL(join(ROOT, "scripts/proxies", name)).href) }));
  const fork = await readForkAlwaysOn(forkFiles, forkIds, (name) => parseForkDotName(name, { extensions: ["mjs"] }));
  assert.deepEqual(fork.problems, [], fork.problems.join("\n"));
  const rel = (abs) => relative(ROOT, abs).split(sep).join("/");
  const code = (f) => /\.(ts|tsx|mts|mjs)$/.test(f) && !/\.test\./.test(f);
  const entries = [
    ...walk(join(APP_DIR, "api/cron")).filter((f) => /[\\/]task\.ts$/.test(f)).map((f) => ({ path: rel(f), kind: "cron" })),
    ...[...ALWAYS_ON_REGISTRIES, ...fork.registries].map((path) => ({ path, kind: "registry" })),
    ...[join(APP_DIR, "layout.tsx"), ...walk(join(ROOT, "src/wiring")), ...walk(join(ROOT, "src/proxies"))]
      .filter(code)
      .map((f) => ({ path: rel(f), kind: "wiring" })),
  ].map((entry) => ({ ...entry, text: readFileSync(join(ROOT, entry.path), "utf8") }));
  const folders = [...new Set(featureGateRules.flatMap((rule) => rule.features ?? []))];
  assert.ok(folders.length > 0, "表を持つ規則が無い(features の読み取りを確認)");
  const { problems, hits } = judgeAlwaysOnEntries(entries, folders, { ...ALWAYS_ON_EXCEPTIONS, ...fork.exceptions });
  assert.deepEqual(problems, [], `常時実行の入口の閉じ漏れ:\n${problems.join("\n")}\n該当: ${hits.join(" / ")}`);
});
