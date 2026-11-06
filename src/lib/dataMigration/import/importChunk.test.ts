// src/lib/dataMigration/import/importChunk.test.ts
//
// import の型変換（getFieldTypes / convertRecordTypes）のテスト。読み方は型の表（src/lib/domain/fields/fieldTypes.mjs）の
// array 属性と importValue 属性で決まる（型名を小文字にして比べない）。行は人が承認した前後一覧（L1.25）のとおり。
// 実行: pnpm test src/lib/dataMigration/import/importChunk.test.ts

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { bulkUpsertOptionsFor, convertRecordTypes, existingRowsFor, getFieldTypes, matchUpsertedRows } from "./importChunk";

const fields = [
  { name: "tags", fieldType: "array" },
  { name: "labels", fieldType: "stringArray" },
  { name: "images", fieldType: "mediaCollection" },
  { name: "name", fieldType: "string" },
  { name: "flag", fieldType: "boolean" },
  { name: "meta", fieldType: "jsonb" },
  { name: "count", fieldType: "integer" },
  { name: "num", fieldType: "number" },
  { name: "rate", fieldType: "float" },
  { name: "big", fieldType: "bigint" },
  { name: "price", fieldType: "numeric(10,2)" },
  { name: "day", fieldType: "date" },
  { name: "at", fieldType: "timestamp With Time Zone" },
  { name: "fsAt", fieldType: "timestamp" },
  { name: "start", fieldType: "time" },
  { name: "lower", fieldType: "timestamp with time zone" },
  { name: "dec", fieldType: "decimal" },
];

const types = getFieldTypes(fields);
const convert = (record: Record<string, unknown>) => convertRecordTypes(record, types);

describe("import の型変換", () => {
  test("読み方の振り分け: 配列 = array・stringArray（mediaCollection は配列にしない）、日付・時刻・数値は表の importValue", () => {
    assert.deepEqual([...types.arrayFields].sort(), ["labels", "tags"]);
    assert.deepEqual([...types.dateFields].sort(), ["at", "day", "fsAt"]);
    assert.deepEqual([...types.timeFields].sort(), ["start"]);
    assert.deepEqual([...types.numberFields].sort(), ["big", "count", "num", "price", "rate"]);
  });

  test("1 date: 値はそのまま、読めない値は null（変化なし）", () => {
    assert.deepEqual(convert({ day: "2026-01-02" }), { day: "2026-01-02" });
    assert.deepEqual(convert({ day: "nope" }), { day: null });
  });

  test("2 timestamp With Time Zone・timestamp: 値はそのまま、読めない値は null（変化なし）", () => {
    assert.deepEqual(convert({ at: "2026-01-02T03:04:00Z", fsAt: "2026-01-02T03:04:00Z" }), { at: "2026-01-02T03:04:00Z", fsAt: "2026-01-02T03:04:00Z" });
    assert.deepEqual(convert({ at: "nope" }), { at: null });
  });

  test("3 time: 空欄だけ null、値はそのまま（以前は日付として読めず null になり値が消えていた）", () => {
    assert.deepEqual(convert({ start: "10:30" }), { start: "10:30" });
    assert.deepEqual(convert({ start: "10:30:00" }), { start: "10:30:00" });
    assert.deepEqual(convert({ start: "" }), { start: null });
    assert.deepEqual(convert({ start: null }), { start: null });
  });

  test("4 integer・number・float・bigint: 数値に、読めない値は null（変化なし）", () => {
    assert.deepEqual(convert({ count: "12", num: "3", rate: "1.5", big: "9007199254740991" }), { count: 12, num: 3, rate: 1.5, big: 9007199254740991 });
    assert.deepEqual(convert({ count: "abc" }), { count: null });
    assert.deepEqual(convert({ count: "" }), { count: null });
  });

  test("5 numeric(10,2): 数値に（以前は文字のまま）、読めない値は null", () => {
    assert.deepEqual(convert({ price: "12.50" }), { price: 12.5 });
    assert.deepEqual(convert({ price: "abc" }), { price: null });
  });

  test("6 array・stringArray: カンマ区切りを配列、空欄は空配列（変化なし）", () => {
    assert.deepEqual(convert({ tags: "x, y", labels: "a,b" }), { tags: ["x", "y"], labels: ["a", "b"] });
    assert.deepEqual(convert({ labels: "" }), { labels: [] });
  });

  test("7 表に無い型名（小文字の timestamp with time zone・decimal）は文字のまま（以前は日付・数値として読んでいた）", () => {
    assert.deepEqual(convert({ lower: "nope", dec: "12.5" }), { lower: "nope", dec: "12.5" });
  });

  test("8 boolean・string・jsonb・mediaCollection・その他: そのまま（変化なし）", () => {
    assert.deepEqual(convert({ name: "a,b", flag: "true", meta: '{"a":1}', images: "p,q", other: "z" }), { name: "a,b", flag: "true", meta: '{"a":1}', images: "p,q", other: "z" });
  });
});

describe("既にある行の扱い（関連ドメインは無い行だけ足す）", () => {
  test("ドメインタイプ: related だけ keep、他は update", () => {
    assert.equal(existingRowsFor("related"), "keep");
    assert.equal(existingRowsFor("main"), "update");
    assert.equal(existingRowsFor("hasMany"), "update");
    assert.equal(existingRowsFor(undefined), "update");
  });

  test("bulkUpsert の options: update はメディア列を UPDATE SET から外す、keep は衝突をスキップ", () => {
    assert.deepEqual(bulkUpsertOptionsFor(["image"], "update"), { excludeFromUpdate: ["image"] });
    assert.equal(bulkUpsertOptionsFor([], "update"), undefined);
    assert.deepEqual(bulkUpsertOptionsFor(["image"], "keep"), { skipDuplicates: true });
    assert.deepEqual(bulkUpsertOptionsFor([], "keep"), { skipDuplicates: true });
  });

  test("返った行の対応づけ: update は順番どおり", () => {
    const rows = [{ id: "a" }, { id: "b" }];
    assert.deepEqual(matchUpsertedRows(["a", "b"], rows, "update"), rows);
  });

  test("返った行の対応づけ: keep は足した行だけを id で引き、既にあった行は null、id の無い行には残りを順に当てる", () => {
    const returned = [{ id: "b" }, { id: "new1" }, { id: "new2" }];
    assert.deepEqual(matchUpsertedRows(["a", "b", null, "c", null], returned, "keep"), [
      null,
      { id: "b" },
      { id: "new1" },
      null,
      { id: "new2" },
    ]);
  });
});

