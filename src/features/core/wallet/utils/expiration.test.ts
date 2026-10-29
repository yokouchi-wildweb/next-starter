// src/features/core/wallet/utils/expiration.test.ts
// resolveWalletLotsInitTypes（ロット初期化の対象通貨の決定）の単体テスト
// 実行: pnpm test:wallet-expiration

import { test } from "node:test";
import assert from "node:assert/strict";
import type { WalletExpirationConfig } from "@/config/app/wallet-expiration.config";
import { resolveWalletLotsInitTypes } from "./expiration";

const CONFIG: Record<string, WalletExpirationConfig> = {
  coin: { expirationDays: 180, sweepEnabled: true },
  point: { expirationDays: 90, expirationBasis: "lastActivity", sweepEnabled: false },
  ticket: { expirationDays: null, sweepEnabled: false },
};

test('"all" はロット管理が有効な全通貨を返す', () => {
  assert.deepEqual(resolveWalletLotsInitTypes("all", CONFIG), ["coin", "point"]);
});

test('"all" で有効な通貨が無ければ空配列を返す', () => {
  assert.deepEqual(
    resolveWalletLotsInitTypes("all", { ticket: { expirationDays: null, sweepEnabled: false } }),
    [],
  );
});

test("指定した通貨だけを返す", () => {
  assert.deepEqual(resolveWalletLotsInitTypes(["point"], CONFIG), ["point"]);
});

test("重複した指定は1つにまとめる", () => {
  assert.deepEqual(resolveWalletLotsInitTypes(["point", "coin", "point"], CONFIG), ["point", "coin"]);
});

test("空の指定は throw する", () => {
  assert.throws(() => resolveWalletLotsInitTypes([], CONFIG), /指定されていません/);
});

test("存在しない通貨を含む指定は throw する", () => {
  assert.throws(() => resolveWalletLotsInitTypes(["coin", "gem"], CONFIG), /存在しない通貨です: gem/);
});

test("ロット管理が無効な通貨を含む指定は throw する", () => {
  assert.throws(() => resolveWalletLotsInitTypes(["coin", "ticket"], CONFIG), /無効.*ticket/);
});
