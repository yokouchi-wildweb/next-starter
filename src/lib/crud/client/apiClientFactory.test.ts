// src/lib/crud/client/apiClientFactory.test.ts
// CRUD クライアントの操作ごとの timeout のテスト(axios の adapter だけ差し替える)。
// 組み立てたクエリがルートのパーサーで読めることは src/app/api/[domain]/search/clientQuery.test.ts。
// 実行: pnpm test src/lib/crud/client/apiClientFactory.test.ts

import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import axios, { type InternalAxiosRequestConfig } from "axios";

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

const NORMAL_OPERATIONS: [string, () => Promise<unknown>][] = [
  ["getAll", () => client.getAll()],
  ["get", () => client.get("1")],
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
