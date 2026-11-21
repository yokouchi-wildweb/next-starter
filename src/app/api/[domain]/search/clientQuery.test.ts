// src/app/api/[domain]/search/clientQuery.test.ts
// crud の client(createApiClient)が組み立てる search のクエリが、このルートのパーサーで指定どおりに読めることのテスト。
// axios の adapter だけ差し替え、実際の直列化の結果をパーサーに渡して確かめる(client 単体の timeout は src/lib/crud/client/apiClientFactory.test.ts)。
// 実行: pnpm test src/app/api/[domain]/search/clientQuery.test.ts

import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import axios, { type InternalAxiosRequestConfig } from "axios";

import { createApiClient } from "@/lib/crud";
import type { ApiClient, WhereExpr } from "@/lib/crud";
import { parseOrderBy, parseSearchFields, parseWhere } from "./utils";

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
