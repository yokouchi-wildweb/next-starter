// src/lib/crud/presenters/domainColumns.test.ts
// 写しから作る一覧の列が domain.json(正規化後)から作る列と同じこと、並べ替えの対象、presenters を渡していない列の表示を確かめる。
// 値が配列の型(型の表の array 属性 = array・stringArray)の列は、sortableFields が true でも列名の指定でもソートしない。
// 実行: pnpm test:crud-presenters

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { normalizeDomainJsonConfig } from "@/lib/domain/definition/normalizeDomainJsonConfig";
import sampleConfig from "@/features/sample/domain.json";
import couponConfig from "@/features/core/coupon/domain.json";
import chatRoomConfig from "@/features/core/chatRoom/domain.json";
import { domainDisplay as sampleDisplay } from "@/features/sample/entities/display";
import { domainDisplay as couponDisplay } from "@/features/core/coupon/entities/display";
import { domainDisplay as chatRoomDisplay } from "@/features/core/chatRoom/entities/display";

import { buildDomainColumns } from "./domainColumns";

type Row = Record<string, unknown>;
type Config = Parameters<typeof buildDomainColumns<Row>>[0]["config"];

const shape = (config: Config) =>
  buildDomainColumns<Row>({ config, sortableFields: true }).map(({ header, sortKey }) => ({ header, sortKey }));

const cases = [
  ["sample", sampleDisplay, sampleConfig],
  ["coupon", couponDisplay, couponConfig],
  ["chatRoom", chatRoomDisplay, chatRoomConfig],
] as const;

for (const [name, display, config] of cases) {
  test(`${name}: 列の見出しと並び替えキーが domain.json と同じ`, () => {
    const columns = shape(display);
    assert.ok(columns.length > 0);
    assert.deepEqual(columns, shape(normalizeDomainJsonConfig(config as Record<string, unknown>) as Config));
  });
}

const sortConfig = {
  tableFields: ["name", "tags", "labels", "count", "image", "images", "created_at"],
  fields: [
    { name: "name", fieldType: "string", formInput: "textInput" },
    { name: "tags", fieldType: "array", formInput: "checkbox" },
    { name: "labels", fieldType: "stringArray", formInput: "multiSelect" },
    { name: "count", fieldType: "integer", formInput: "numberInput" },
    { name: "image", fieldType: "mediaUploader", formInput: "mediaUploader" },
    { name: "images", fieldType: "mediaCollection", formInput: "mediaUploaderMulti" },
    { name: "created_at", fieldType: "timestamp With Time Zone", formInput: "datetimeInput" },
  ],
};

const sortKeys = (sortableFields: string[] | true | undefined) =>
  Object.fromEntries(
    buildDomainColumns({ config: sortConfig, sortableFields }).map((column, i) => [sortConfig.tableFields[i], column.sortKey]),
  );

describe("buildDomainColumns: 並べ替え", () => {
  test("sortableFields 省略: どの列もソートしない", () => {
    assert.deepEqual(Object.values(sortKeys(undefined)), Array(sortConfig.tableFields.length).fill(undefined));
  });

  test("sortableFields true: 配列の型（array・stringArray）とメディア入力の列を除いてソートする", () => {
    assert.deepEqual(sortKeys(true), {
      name: "name",
      tags: undefined,
      labels: undefined,
      count: "count",
      image: undefined,
      images: undefined,
      created_at: "created_at",
    });
  });

  test("列名の指定: 指定した列だけソートし、配列の型は指定してもソートしない", () => {
    assert.deepEqual(sortKeys(["name", "tags", "labels", "image"]), {
      name: "name",
      tags: undefined,
      labels: undefined,
      count: undefined,
      image: "image",
      images: undefined,
      created_at: undefined,
    });
  });
});

// ---- presenters を渡していない列の表示（presenterFor の答え + 一覧特有の扱い） ----

const IMG = "https://example.com/a.png";
const html = (node: unknown) => renderToStaticMarkup(node as React.ReactElement);
const imgCount = (node: unknown) => html(node).match(/<img /g)?.length ?? 0;

const renderConfig = {
  tableFields: [
    "flag", "radioFlag", "count", "selectCount", "big", "tags", "labels", "status", "rawEnum",
    "startsAt", "day", "image", "hiddenImage", "images", "legacyImages", "name", "body", "meta",
    "category_id", "createdAt", "updatedAt",
  ],
  fields: [
    { name: "flag", fieldType: "boolean", formInput: "switchInput" },
    { name: "radioFlag", fieldType: "boolean", formInput: "radio" },
    { name: "count", fieldType: "integer", formInput: "numberInput" },
    { name: "selectCount", fieldType: "integer", formInput: "select", options: [{ value: 1234, label: "千" }] },
    { name: "big", fieldType: "bigint", formInput: "hidden" },
    { name: "tags", fieldType: "array", formInput: "checkbox" },
    { name: "labels", fieldType: "stringArray", formInput: "multiSelect" },
    { name: "status", fieldType: "enum", formInput: "select", options: [{ value: "on", label: "公開" }] },
    { name: "rawEnum", fieldType: "enum", formInput: "select" },
    { name: "startsAt", fieldType: "timestamp With Time Zone", formInput: "datetimeInput" },
    { name: "day", fieldType: "date", formInput: "dateInput" },
    { name: "image", fieldType: "mediaUploader", formInput: "mediaUploader" },
    { name: "hiddenImage", fieldType: "mediaUploader", formInput: "hidden" },
    { name: "images", fieldType: "mediaCollection", formInput: "mediaUploaderMulti" },
    { name: "legacyImages", fieldType: "mediaUploaderMulti", formInput: "mediaUploaderMulti" },
    { name: "name", fieldType: "string", formInput: "textInput" },
    { name: "body", fieldType: "string", formInput: "textarea" },
    { name: "meta", fieldType: "jsonb", formInput: "none" },
  ],
  relations: [{ fieldName: "category_id", label: "カテゴリ" }],
};

const renderAll = (record: Record<string, unknown>) => {
  const columns = buildDomainColumns<Record<string, unknown>>({ config: renderConfig, truncateLength: 5 });
  return Object.fromEntries(columns.map((column, i) => [renderConfig.tableFields[i], column.render(record)]));
};

describe("buildDomainColumns: presenters の無い列の表示", () => {
  const out = renderAll({
    flag: true,
    radioFlag: false,
    count: 1234,
    selectCount: 1234,
    big: 5678,
    tags: ["a", "b"],
    labels: [],
    status: "on",
    rawEnum: "off",
    startsAt: "2026-01-02T03:04:00.000Z",
    day: "2026-01-02",
    image: IMG,
    hiddenImage: IMG,
    images: [IMG, IMG, IMG],
    legacyImages: [IMG, IMG],
    name: "なまえ",
    body: "あいうえおかきくけこ",
    meta: null,
    category_id: "c1",
    createdAt: "2026-01-02T03:04:00.000Z",
  });

  test("boolean は はい / いいえ（radio も）", () => {
    assert.equal(out.flag, "はい");
    assert.equal(out.radioFlag, "いいえ");
  });

  test("数値の型は入力欄によらず桁区切り。型に表示が無い bigint は入力欄で決まる（hidden は文字のまま）", () => {
    assert.equal(out.count, (1234).toLocaleString());
    assert.equal(out.selectCount, (1234).toLocaleString());
    assert.equal(out.big, "5678");
  });

  test("配列は「, 」区切り、空配列は空欄", () => {
    assert.equal(out.tags, "a, b");
    assert.equal(out.labels, "");
  });

  test("enum は選択肢のラベル、選択肢が無ければ値そのまま", () => {
    assert.equal(out.status, "公開");
    assert.equal(out.rawEnum, "off");
  });

  test("画像は入力欄によらずサムネイル、集まりは先頭 1 件 + N、旧来の複数メディア列は重ねたサムネイル", () => {
    assert.equal(imgCount(out.image), 1);
    assert.equal(imgCount(out.hiddenImage), 1);
    assert.equal(imgCount(out.images), 1);
    assert.match(html(out.images), /\+2/);
    assert.equal(imgCount(out.legacyImages), 2);
  });

  test("一覧特有の扱い: textarea は切り詰め、null は空欄、文字はそのまま", () => {
    assert.notEqual(out.body, "あいうえおかきくけこ");
    assert.ok(String(out.body).startsWith("あいうえお"));
    assert.equal(out.meta, "");
    assert.equal(out.name, "なまえ");
  });

  test("日時・日付・createdAt は日付の書式、リレーションの列は値そのまま", () => {
    assert.match(String(out.startsAt), /^2026\/01\/02 \d{2}:04$/);
    assert.equal(out.day, "2026/01/02");
    assert.match(String(out.createdAt), /^2026\/01\/02 \d{2}:04$/);
    assert.equal(out.category_id, "c1");
    assert.equal(out.updatedAt, null); // 日付が無ければ何も描かない（今までどおり）
  });

  test("値が null の boolean・数値も空欄", () => {
    const empty = renderAll({});
    assert.equal(empty.flag, "");
    assert.equal(empty.count, "");
    assert.equal(empty.status, "");
    assert.equal(empty.tags, "");
  });
});
