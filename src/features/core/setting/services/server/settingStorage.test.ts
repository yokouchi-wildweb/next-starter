// src/features/core/setting/services/server/settingStorage.test.ts
// 実行: pnpm test:setting

import assert from "node:assert/strict";
import { test } from "node:test";

import { PgDialect } from "drizzle-orm/pg-core";
import { z } from "zod";

import { COLUMN_EXISTS_SQL, COPY_SQL, VERIFY_SQL, task } from "../../../../../../scripts/tasks/setting-copy-list-per-page";
import { fields } from "../../extensions/fields";
import { readSettingValues, settingDefaultOf } from "./read";
import { mergedExtendedSql, validateSettingInput } from "./save";

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

test("上流のキーの既定: adminListPerPage 100、メンテナンスは無効", () => {
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
