// src/features/core/messaging/services/server/auditActions.test.ts
// 見張り: messaging の(テストでない)コードの監査の action の文字列リテラル(messaging.<entity>.<verb> の 3 段)が、
// 監査ログの規則(AuditLogCreateSchema の action = 英小文字・数字・_ の段、camelCase 不可)を通ること。
// 規則に合わない名前は送った後の auditLogger.record で投げ、送れた回が 500 になる(画面の確かめ ng-1・ng-2)。同じ誤りを出荷させない
// 実行: pnpm test src/features/core/messaging/services/server/auditActions.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { AuditLogCreateSchema } from "@/features/core/auditLog/entities/schema";

const domainDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
/** 3 段の messaging.<entity>.<verb>(2 段の連絡の鍵 messaging.adminMarketing などは当たらない) */
const ACTION_LITERAL = /["'`](messaging\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+)["'`]/g;

function codeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : codeFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

test("messaging の監査の action はどれも監査ログの規則を通る", () => {
  const actionSchema = AuditLogCreateSchema.shape.action;
  const found = new Map<string, string>();
  for (const file of codeFiles(domainDir)) {
    for (const match of readFileSync(file, "utf8").matchAll(ACTION_LITERAL)) found.set(match[1], relative(domainDir, file));
  }
  // 読み取りが外れていない(知っている名前が見つかる)
  for (const known of ["messaging.dispatch.sent", "messaging.dispatch.test_sent", "messaging.dispatch.bulk_sent", "messaging.override.updated"]) {
    assert.ok(found.has(known), `${known} が見つからない(読み取りを確認)`);
  }
  const bad = [...found].filter(([action]) => !actionSchema.safeParse(action).success).map(([action, file]) => `${file}: ${action}`);
  assert.deepEqual(bad, []);
});
