// src/features/core/setting/services/server/settingStorage.test.ts
// fork でも走る: 動きの検査は全 Tier、上流のキー・セクションの組と既定の値の厳密な比較は Tier1 だけ
// （fork はキー・セクションを足し、既定の値を書き換える。fork では上流のキー・セクションが残っていることを見る）
// 実行: pnpm test:setting

import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";

import { PgDialect } from "drizzle-orm/pg-core";
import { z } from "zod";

import { COLUMN_EXISTS_SQL, COPY_SQL, VERIFY_SQL, task } from "../../../../../../scripts/tasks/setting-copy-list-per-page";
import { fields } from "../../extensions/fields";
import { sections } from "../../extensions/sections";
import { publicSettingKeys, settingKeysFor } from "./access";
import { buildSectionForm, firstOpenSection, listSections, settingSectionHref } from "../../utils/sectionForm";
import { readSettingValues, settingDefaultOf } from "./read";
import { mergedExtendedSql, validateSettingInput } from "./save";
import { readForkIdentity } from "@/lib/forkOwnership/forkIds.mjs";

const ROOT = resolve(import.meta.dirname, "../../../../../..");
const { isTier1 } = readForkIdentity(ROOT);
/** 上流の既定の値の検査（fork では飛ばす） */
const tier1Only = { skip: isTier1 ? false : "上流の既定の値の検査（Tier1 だけ）" };
/** 上流が持つキーとセクション（fields/・sections/ の上流の項目） */
const UPSTREAM_KEYS = ["adminListPerPage", "maintenanceEnabled", "maintenanceEndAt", "maintenanceStartAt"];
const UPSTREAM_SECTIONS = ["general", "maintenance"];
/** Tier1 は完全一致、fork は上流の項目を同じ順で含むこと（fork の項目は間に入ってよい） */
const assertUpstreamItems = (actual: readonly string[], upstream: readonly string[]) => {
  if (isTier1) {
    assert.deepEqual([...actual], [...upstream]);
    return;
  }
  const present = actual.filter((item) => upstream.includes(item));
  assert.deepEqual(present, [...upstream], `上流の項目が欠けているか順が違う: ${actual.join(", ")}`);
};

const defs = {
  count: { schema: z.coerce.number().int().min(1).default(100) },
  flag: { schema: z.coerce.boolean().default(false) },
  over: { schema: z.number().default(1), default: 5 },
};

const quietly = <T>(fn: () => T): { result: T; warnings: string[] } => {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (m: string) => warnings.push(m);
  try {
    return { result: fn(), warnings };
  } finally {
    console.warn = original;
  }
};

test("読み: 無いキーは既定値、override の default が優先、行なしも既定値", () => {
  assert.deepEqual(readSettingValues(null, defs), { count: 100, flag: false, over: 5 });
  assert.deepEqual(readSettingValues({ count: 3 }, defs), { count: 3, flag: false, over: 5 });
  assert.equal(settingDefaultOf(defs.count), 100);
});

test("読み: 合わないキーだけ既定値 + 警告、値はログに出さず保存値も変えない", () => {
  const stored = { count: "secret-value", flag: true };
  const { result, warnings } = quietly(() => readSettingValues(stored, defs));
  assert.deepEqual(result, { count: 100, flag: true, over: 5 });
  assert.equal(warnings.length, 1);
  assert.doesNotMatch(warnings[0], /secret-value/);
  assert.equal(stored.count, "secret-value");
});

test("読み: 指定のキーだけ検証する、一覧に無い保存値は返さない", () => {
  const { result, warnings } = quietly(() => readSettingValues({ count: "bad", gone: 1, flag: true }, defs, ["flag"]));
  assert.deepEqual(result, { flag: true });
  assert.equal(warnings.length, 0);
});

test("保存の検証: 送ったキーだけ、undefined は送っていない、一覧に無いキーと不正な値は 400", () => {
  assert.deepEqual(validateSettingInput({ flag: true, count: undefined }, defs), { flag: true });
  assert.throws(() => validateSettingInput({ nope: 1 }, defs), (e: { status?: number }) => e.status === 400);
  assert.throws(() => validateSettingInput({ count: 0 }, defs), (e: { status?: number }) => e.status === 400);
});

test("保存の式: 1 本の文で重ね、一覧のキーだけに絞り、残りが 0 なら空", () => {
  const { sql, params } = new PgDialect().sqlToQuery(mergedExtendedSql({ a: 1 }, ["a", "b"]));
  assert.match(sql, /COALESCE\(\(\s*SELECT jsonb_object_agg/);
  assert.match(sql, /\|\| \$1::jsonb/);
  assert.match(sql, /IN \(\$2, \$3\)/);
  assert.match(sql, /'\{\}'::jsonb\)$/);
  assert.deepEqual(params, ['{"a":1}', "a", "b"]);
});

test("上流のキーの既定: adminListPerPage 100、メンテナンスは無効", tier1Only, () => {
  const values = readSettingValues(null, fields);
  assert.equal(values.adminListPerPage, 100);
  assert.equal(values.maintenanceEnabled, false);
  assert.equal(values.maintenanceStartAt, null);
});

test("写す task: 既にあるキーを書き換えない、一致の確かめ、列が無ければ何もしない", () => {
  assert.equal(task.name, "setting-copy-list-per-page");
  assert.match(COPY_SQL, /WHERE NOT \(COALESCE\(extended, '\{\}'::jsonb\) \? 'adminListPerPage'\)/);
  assert.match(VERIFY_SQL, /IS DISTINCT FROM admin_list_per_page::text/);
  assert.match(COLUMN_EXISTS_SQL, /admin_list_per_page/);
});

test("権限: キーの allowRoles → セクションの allowRoles → 管理カテゴリ全員", () => {
  const f = {
    own: { schema: z.number().default(1), allowRoles: ["boss"] },
    inSection: { schema: z.number().default(1), ui: { section: "s", field: {} } },
    openSection: { schema: z.number().default(1), ui: { section: "t", field: {} } },
    noUi: { schema: z.number().default(1) },
    overrideSection: { schema: z.number().default(1), allowRoles: ["staff"], ui: { section: "s", field: {} } },
  } as never;
  const s = { s: { key: "s", label: "", order: 1, allowRoles: ["boss"] }, t: { key: "t", label: "", order: 2 } } as never;
  assert.deepEqual(settingKeysFor("boss", f, s), ["own", "inSection", "openSection", "noUi"]);
  assert.deepEqual(settingKeysFor("staff", f, s), ["openSection", "noUi", "overrideSection"]);
});

test("公開: public true のキーだけ。上流のキーは全部非公開", () => {
  assert.deepEqual(publicSettingKeys({ a: { schema: z.number().default(1), public: true }, b: { schema: z.number().default(1) } }), ["a"]);
  // fork が足したキーは public でもよい（上流のキーだけを見る）
  assert.deepEqual(publicSettingKeys(fields).filter((key) => UPSTREAM_KEYS.includes(key)), []);
  assertUpstreamItems(Object.keys(fields).sort(), UPSTREAM_KEYS);
  assert.deepEqual(settingKeysFor("admin", fields, sections).sort(), Object.keys(fields).sort());
});

test("フォーム: セクションの欄を ui.order で並べ、許されていないキーは欄も送信も無い", () => {
  const current = { adminListPerPage: 5, maintenanceEnabled: true, maintenanceEndAt: null };
  const m = buildSectionForm("maintenance", fields, current);
  // fork は上流のセクションにキーを足せる（Tier1 は完全一致、fork は上流のキーが同じ順で残っていること）
  assertUpstreamItems(m.keys, ["maintenanceEnabled", "maintenanceEndAt"]);
  assert.deepEqual(m.fieldConfigs.map((f) => f.name), m.keys);
  assert.deepEqual(Object.keys(m.schema.shape), m.keys);
  assert.equal(m.defaultValues.maintenanceEnabled, true);
  assert.equal(m.defaultValues.maintenanceEndAt, null);
  if (isTier1) assert.equal(m.fieldConfigs[0].label, "メンテナンスモード");
  const g = buildSectionForm("general", fields, current);
  assertUpstreamItems(g.keys, ["adminListPerPage"]);
  if (isTier1) assert.equal(m.schema.safeParse({ maintenanceEnabled: true, maintenanceEndAt: null }).success, true);
});

test("セクション: order 昇順", () => {
  const listed = listSections(sections);
  const orders = listed.map((s) => s.order);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
  // fork はセクションを足せる（上流のセクションが同じ順で残っていること）
  assertUpstreamItems(listed.map((s) => s.key), UPSTREAM_SECTIONS);
});

test("既定のセクション: order 昇順で住所の開いた最初の節(閉じた機能の節を飛ばす)", () => {
  const fixture = {
    b: { key: "b", label: "B", order: 20 },
    a: { key: "a", label: "A", order: 10 },
    c: { key: "c", label: "C", order: 30 },
  };
  assert.equal(settingSectionHref("a"), "/admin/settings/a");
  assert.equal(firstOpenSection(fixture, () => true)?.key, "a");
  assert.equal(firstOpenSection(fixture, (href) => href !== "/admin/settings/a")?.key, "b");
  assert.equal(firstOpenSection(fixture, () => false), undefined);
  assert.equal(firstOpenSection(sections, () => true)?.key, listSections(sections)[0]?.key);
});
