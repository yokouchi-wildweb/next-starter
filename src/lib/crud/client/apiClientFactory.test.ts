// src/lib/crud/client/apiClientFactory.test.ts
// CRUD クライアントが組み立てるクエリと、操作ごとの timeout のテスト。
// axios の adapter だけ差し替え、実際の直列化の結果をルートのパーサーに渡して確かめる。
// 実行: pnpm test src/lib/crud/client/apiClientFactory.test.ts

import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import axios, { type InternalAxiosRequestConfig } from "axios";

import { parseOrderBy, parseSearchFields, parseWhere } from "@/app/api/[domain]/search/utils";
import type { ApiClient, WhereExpr } from "../types";
import { createApiClient } from "./apiClientFactory";

const requests: InternalAxiosRequestConfig[] = [];
const originalAdapter = axios.defaults.adapter;

beforeEach(() => {
  requests.length = 0;
  axios.defaults.adapter = async (config) => {
    requests.push(config);
    return { data: {}, status: 200, statusText: "OK", headers: {}, config };
  };
});

afterEach(() => {
  axios.defaults.adapter = originalAdapter;
});

const client = createApiClient<{ id: string }>("/api/sample") as Required<ApiClient<{ id: string }>>;

/** 最後のリクエストのクエリ（ルートと同じ URLSearchParams で読む） */
const lastQuery = () => new URL(axios.getUri(requests.at(-1)), "http://localhost").searchParams;

test("search: orderBy はルートの parseOrderBy が指定どおりに読める形で届く", async () => {
  await client.search({ orderBy: [["createdAt", "DESC"], ["name", "ASC"]] });
  assert.deepEqual(parseOrderBy(lastQuery().getAll("orderBy")), [["createdAt", "DESC"], ["name", "ASC"]]);
});

test("search: orderBy の 3 要素形もそのまま届く", async () => {
  await client.search({ orderBy: [["name", "ASC", "FIRST"]] });
  assert.deepEqual(parseOrderBy(lastQuery().getAll("orderBy")), [["name", "ASC", "FIRST"]]);
});

test("search: 未指定・null・空の orderBy は送らない", async () => {
  for (const orderBy of [undefined, null, []]) {
    await client.search({ orderBy } as never);
    assert.equal(lastQuery().has("orderBy"), false);
  }
});

test("search: searchFields はルートの parseSearchFields が読める形で届く", async () => {
  await client.search({ searchFields: ["name", "description"] });
  assert.deepEqual(parseSearchFields(lastQuery().getAll("searchFields")), ["name", "description"]);
});

test("search: 未指定・空の searchFields は送らない", async () => {
  for (const searchFields of [undefined, []]) {
    await client.search({ searchFields });
    assert.equal(lastQuery().has("searchFields"), false);
  }
});

test("search: 値なしの where がルートまで届き、他のパラメータはそのまま", async () => {
  const where: WhereExpr = { field: "deletedAt", op: "isNull" };
  await client.search({ where, page: 2, limit: 10, searchQuery: "abc" });
  const query = lastQuery();
  assert.deepEqual(parseWhere(query.get("where")), where);
  assert.equal(query.get("page"), "2");
  assert.equal(query.get("limit"), "10");
  assert.equal(query.get("searchQuery"), "abc");
});

const NORMAL_OPERATIONS: [string, () => Promise<unknown>][] = [
  ["getAll", () => client.getAll()],
  ["getById", () => client.getById("1")],
  ["create", () => client.create({})],
  ["update", () => client.update("1", {})],
  ["delete", () => client.delete("1")],
  ["search", () => client.search({})],
  ["upsert", () => client.upsert({})],
  ["restore", () => client.restore("1")],
  ["hardDelete", () => client.hardDelete("1")],
  ["reorder", () => client.reorder("1", null)],
  ["searchForSorting", () => client.searchForSorting({})],
  ["count", () => client.count({})],
];

const LONG_OPERATIONS: [string, () => Promise<unknown>][] = [
  ["bulkDeleteByIds", () => client.bulkDeleteByIds(["1"])],
  ["bulkDeleteByQuery", () => client.bulkDeleteByQuery({ field: "id", op: "eq", value: "1" })],
  ["bulkUpsert", () => client.bulkUpsert([{}])],
  ["replaceByQuery", () => client.replaceByQuery({ field: "id", op: "eq", value: "1" }, [{}])],
  ["bulkUpdate", () => client.bulkUpdate([])],
  ["bulkUpdateByIds", () => client.bulkUpdateByIds(["1"], {})],
  ["bulkAddRelation", () => client.bulkAddRelation("tags", ["1"], ["2"])],
  ["bulkRemoveRelation", () => client.bulkRemoveRelation("tags", ["1"], ["2"])],
  ["duplicate", () => client.duplicate("1")],
];

for (const [name, run] of NORMAL_OPERATIONS) {
  test(`timeout: ${name} は 60 秒`, async () => {
    await run();
    assert.equal(requests.at(-1)?.timeout, 60_000);
  });
}

for (const [name, run] of LONG_OPERATIONS) {
  test(`timeout: ${name} は上限なし(アプリ全体の既定のタイムアウトも外す印 defaultTimeout: false)`, async () => {
    await run();
    assert.equal(requests.at(-1)?.timeout, 0);
    assert.equal(requests.at(-1)?.defaultTimeout, false);
  });
}

test("timeout: axios.defaults は変えない", () => {
  assert.equal(axios.defaults.timeout, 0);
});

// 型の確認（pnpm typecheck で検査される）
export const whereTypeCases: WhereExpr[] = [
  { field: "a", op: "isNull" },
  { field: "a", op: "isNotNull" },
  { field: "a", op: "isNull", value: null },
  { field: "a", op: "isNotNull", value: true },
  { field: "a", op: "eq", value: null },
  // @ts-expect-error isNull / isNotNull 以外は value が必須
  { field: "a", op: "eq" },
];
