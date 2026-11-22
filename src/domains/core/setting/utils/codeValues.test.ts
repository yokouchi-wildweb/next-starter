// src/domains/core/setting/utils/codeValues.test.ts
// コードで持つキー(config の codeValues)の検証・保存の拒否・期間の判定・読みのメモ。DB に触らない
// 実行: pnpm test src/domains/core/setting/utils/codeValues.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";

import { z } from "zod";

import { DomainError } from "@/lib/errors";

import { fields } from "../extensions/fields";
import { createReadMemo } from "../services/server/readMemo";
import { assertNotCodeValues } from "../services/server/save";
import { resolveCodeValues } from "./codeValues";
import { isMaintenanceWindowActive } from "./maintenanceWindow";

test("codeValues: キーの定義で検証し、書かない部分はキーの既定値、日時の文字列は Date", () => {
  const values = resolveCodeValues({ maintenance: { enabled: true, endAt: "2026-12-01T04:00:00+09:00" } }, fields);
  assert.deepEqual(values.maintenance, { enabled: true, startAt: null, endAt: new Date("2026-11-30T19:00:00Z") });
  assert.deepEqual(resolveCodeValues({}, fields), {});
  assert.ok(Object.isFrozen(values));
});

test("codeValues: 定義に無いキー・定義に合わない値は止める", () => {
  assert.throws(() => resolveCodeValues({ noSuchKey: 1 }, fields), /noSuchKey/);
  const f = { count: { schema: z.number().int().default(1) } } as never;
  assert.throws(() => resolveCodeValues({ count: "あ" }, f), /"count"/);
});

test("保存: コードで持つキーを送ったら 409、送っていない(undefined)キー・ほかのキーは通す", () => {
  assert.throws(
    () => assertNotCodeValues({ maintenance: { enabled: false } }, ["maintenance"]),
    (error: unknown) => error instanceof DomainError && error.status === 409,
  );
  assert.doesNotThrow(() => assertNotCodeValues({ maintenance: undefined, adminListPerPage: 50 }, ["maintenance"]));
  assert.doesNotThrow(() => assertNotCodeValues({ maintenance: { enabled: true } }, []));
});

test("期間の判定: 無効・開始前・期間中・終了時刻ちょうど・端なし", () => {
  const value = { enabled: true, startAt: new Date(1000), endAt: new Date(2000) };
  assert.equal(isMaintenanceWindowActive({ ...value, enabled: false }, 1500), false);
  assert.equal(isMaintenanceWindowActive(value, 999), false);
  assert.equal(isMaintenanceWindowActive(value, 1000), true);
  assert.equal(isMaintenanceWindowActive(value, 1999), true);
  assert.equal(isMaintenanceWindowActive(value, 2000), false);
  assert.equal(isMaintenanceWindowActive({ enabled: true, startAt: null, endAt: null }, 0), true);
});

test("読みのメモ: 期限の中は読まない、期限の外・clear の後は読み直す、0 は毎回、同時の読みは 1 本、失敗は覚えない", async () => {
  let now = 0;
  let loads = 0;
  let fail = false;
  let ttl = 100;
  const memo = createReadMemo(async () => {
    loads += 1;
    if (fail) throw new Error("down");
    return loads;
  }, () => ttl, () => now);

  const [a, b] = await Promise.all([memo.get(), memo.get()]);
  assert.deepEqual([a, b, loads], [1, 1, 1]);
  now = 99;
  assert.equal(await memo.get(), 1);
  now = 100;
  assert.equal(await memo.get(), 2);
  memo.clear();
  assert.equal(await memo.get(), 3);

  fail = true;
  memo.clear();
  await assert.rejects(memo.get(), /down/);
  fail = false;
  assert.equal(await memo.get(), 5);

  ttl = 0;
  await memo.get();
  await memo.get();
  assert.equal(loads, 7);
});
