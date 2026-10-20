// Feature Gate（ルートゲート + スキーマゲート）の規律テスト。
// 実行: pnpm test:feature-gate (node:test + tsx。config / registry の .ts を読むため tsx ランナーを使う)
//
// 定義: src/config/app/feature-gate.config.ts / 設計: src/proxies/README.md
//
// 検査の対象は「今 enabled: false のルール」だけ。有効な機能のルートは開いていて正しく、
// 機能を切ったときに初めて「テーブルが無いのに開いているルート」が問題になるため。
// upstream は全機能が有効なので、ゲート対象ドメインを触るときは FEATURE_GATE_CHECK=all で全ルールを無効とみなして検査する:
//   FEATURE_GATE_CHECK=all pnpm test:feature-gate
//
// 守りたい契約:
// 1. tables に書いたテーブル名は schemaRegistry に実在する
// 2. 無効なルールのドメイン（そのテーブルを entities/drizzle.ts で定義するドメイン）を
//    import するルート（route.ts / page.tsx と、その _screen/ _components/ 配下）は、そのルールの pathPatterns で閉じている
//    （新しいルートを足して定義に書き忘れると失敗する）。意図的に閉じないルートは ROUTE_EXCEPTIONS に理由付きで書く（upstream 用）
// 3. 同じドメインの汎用 CRUD（/api/<domain>）も閉じている
// 4. 現在のフラグの組み合わせでスキーマゲートが成立する（外すテーブルを残すテーブルが外部キーで参照しない）
//    外部キーに現れない機能間の前提（紹介 → クーポン）も満たす
// 5. スキーマゲートは enum を外さず、無効なテーブルだけを両側（imports / tablesFilter）から外す
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, resolve, sep } from "node:path";

import { getTableName, is } from "drizzle-orm";
import { isPgEnum, PgTable } from "drizzle-orm/pg-core";

import { serviceRegistry } from "../registry/serviceRegistry.ts";
import { APP_FEATURES } from "../config/app/app-features.config.ts";
import { featureGateRules } from "../config/app/feature-gate.config.ts";
import { applySchemaGate } from "../../scripts/registry/schemaGate.ts";

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

// パターン（固定セグメント）がルート（動的セグメントを含みうる）を覆うか。動的セグメントはどの値にも一致しうる
const patternCoversRoute = (pattern, routeSegments) => {
  const patternSegments = pattern.split("/").filter(Boolean);
  if (routeSegments.length < patternSegments.length) return false;
  return patternSegments.every((seg, i) => routeSegments[i] === seg || /^\[.+\]$/.test(routeSegments[i]));
};

const rulesWithTables = featureGateRules.filter((rule) => (rule.tables ?? []).length > 0);
// ルートの被覆を検査するルール（無効なもの。CHECK_ALL なら全部）
const checkedRules = rulesWithTables.filter((rule) => CHECK_ALL || !rule.enabled);
const schemaTableNames = new Set(
  Object.values(schema)
    .filter((value) => is(value, PgTable))
    .map((table) => getTableName(table)),
);

test("tables に書いたテーブル名は schemaRegistry に実在する", () => {
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
  const allDisabled = featureGateRules.map((rule) => ({ ...rule, enabled: false }));
  assert.doesNotThrow(() => applySchemaGate(schema, allDisabled));
});

test("スキーマゲートは無効なテーブルを両側から外し、enum は残す", { skip: !CHECK_ALL && CHECK_ALL_ONLY }, () => {
  const rules = featureGateRules.map((rule) => ({ ...rule, enabled: false }));
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
  const rules = featureGateRules.map((rule) => ({ ...rule, enabled: true }));
  const gate = applySchemaGate(schema, rules);
  assert.equal(gate.tablesFilter, undefined);
  assert.equal(Object.keys(gate.imports).length, Object.keys(schema).length);
});

test("payment だけ有効で wallet が無効な組み合わせは外部キーで拒否される", () => {
  const rules = featureGateRules.map((rule) => ({
    ...rule,
    enabled: !(rule.tables ?? []).includes("wallets"),
  }));
  assert.throws(() => applySchemaGate(schema, rules), /purchase_requests → wallet_histories/);
});
