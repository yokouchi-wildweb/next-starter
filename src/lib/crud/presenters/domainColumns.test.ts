// src/lib/crud/presenters/domainColumns.test.ts
// 写しから作る一覧の列が domain.json(正規化後)から作る列と同じこと、並べ替えの対象を確かめる。
// 値が配列の型(型の表の array 属性 = array・stringArray)の列は、sortableFields が true でも列名の指定でもソートしない。
// 実行: pnpm test:crud-presenters

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { normalizeDomainJsonConfig } from "@/lib/domain/config/normalizeDomainJsonConfig";
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
