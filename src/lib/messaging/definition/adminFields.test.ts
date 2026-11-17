// 管理画面の欄の値の検査(checkAdminFieldValue / adminFieldAllowedKeys)
// - adminEditable の外・欄の型・知らない {{鍵}}・秘密の vars を落とす
// - コードの値は今は無い(定義がひな形 + 欄の中身になった。TODO 指令 56: ひな形の欄の鍵へ替えて戻す)ので、並びの長さは見ない
// 実行: pnpm test src/lib/messaging/definition/adminFields.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import { resolveMessageDefinition } from "./validate";
import { defineMessage } from "./defineMessage";
import { secretVar } from "./secret";
import {
  adminFieldAllowedKeys,
  adminFieldCodeValue,
  checkAdminFieldValue,
} from "./adminFields";

const resolved = resolveMessageDefinition(
  defineMessage({
    key: "shop.notice",
    label: "テストの連絡",
    category: "shop",
    vars: z.object({ name: z.string(), token: secretVar(z.string()) }),
    adminEditableOnly: ["email.subject", "email.paragraphs", "inApp.body"],
    layout: "notice",
    values: { subject: "{{name}} 様へ", blocks: [{ type: "paragraph", text: "一" }] },
  }),
  undefined,
  { kind: "transactional", channels: ["email", "inApp"] },
);

test("使ってよい鍵: vars(秘密を除く)・共通の文脈・provides", () => {
  assert.deepEqual(adminFieldAllowedKeys(resolved, ["displayName"]), [
    "name",
    "recipientName",
    "recipientEmail",
    "serviceName",
    "appBaseUrl",
    "displayName",
  ]);
  assert.equal(adminFieldCodeValue(resolved, "email.paragraphs"), undefined);
});

test("通る値と落ちる値", () => {
  assert.equal(checkAdminFieldValue(resolved, "email.subject", "{{recipientName}} {{name}} 様"), null);
  assert.equal(checkAdminFieldValue(resolved, "email.paragraphs", ["a", "b"]), null);
  const cases: [string, unknown, string][] = [
    ["inApp.title", "x", "not_editable"],
    ["email.cta", { label: "a", url: "b" }, "not_editable"],
    ["email.subject", "", "invalid_value"],
    ["email.subject", 3, "invalid_value"],
    ["email.subject", undefined, "invalid_value"],
    ["email.subject", "{{nope}}", "unknown_variable"],
    ["email.subject", "{{token}}", "unknown_variable"],
    ["email.paragraphs", ["{{token}}", "b"], "unknown_variable"],
  ];
  for (const [path, value, code] of cases) {
    assert.equal(checkAdminFieldValue(resolved, path, value)?.code, code, `${path} ${JSON.stringify(value)}`);
  }
  assert.equal(checkAdminFieldValue(resolved, "email.subject", "{{displayName}}", { variableKeys: ["displayName"] }), null);
});
