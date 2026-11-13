// 管理画面の欄の値の検査と重ね方(checkAdminFieldValue / applyAdminFieldValues / adminFieldAllowedKeys)
// - adminEditable の外・欄の型・配列の長さ・知らない {{鍵}}・秘密の vars を落とす
// - 通る欄だけ重ね、落ちた欄はコードの値のまま rejected に返す
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
  applyAdminFieldValues,
  checkAdminFieldValue,
} from "./adminFields";

const resolved = resolveMessageDefinition(
  defineMessage({
    key: "shop.notice",
    category: "shop",
    vars: z.object({ name: z.string(), token: secretVar(z.string()) }),
    adminEditable: ["email.subject", "email.paragraphs", "inApp.body"],
    content: {
      email: { subject: "{{name}} 様へ", paragraphs: ["一", "二"], cta: { label: "開く", url: "{{token}}" } },
      inApp: { title: "題", body: "本文" },
    },
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
  assert.deepEqual(adminFieldCodeValue(resolved, "email.paragraphs"), ["一", "二"]);
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
    ["email.paragraphs", ["a"], "length_mismatch"],
    ["email.subject", "{{nope}}", "unknown_variable"],
    ["email.subject", "{{token}}", "unknown_variable"],
    ["email.paragraphs", ["{{token}}", "b"], "unknown_variable"],
  ];
  for (const [path, value, code] of cases) {
    assert.equal(checkAdminFieldValue(resolved, path, value)?.code, code, `${path} ${JSON.stringify(value)}`);
  }
  assert.equal(checkAdminFieldValue(resolved, "email.subject", "{{displayName}}", { variableKeys: ["displayName"] }), null);
});

test("重ね方: 通る欄だけ差し替え、落ちた欄はコードの値で rejected に返す", () => {
  const { resolved: merged, rejected } = applyAdminFieldValues(resolved, [
    { fieldPath: "email.subject", value: "新しい件名" },
    { fieldPath: "inApp.body", value: "{{nope}}" },
    { fieldPath: "inApp.title", value: "編集不可" },
  ]);
  const content = merged.content as Record<string, Record<string, unknown>>;
  assert.equal(content.email.subject, "新しい件名");
  assert.deepEqual(content.email.paragraphs, ["一", "二"]);
  assert.equal(content.inApp.body, "本文");
  assert.equal(content.inApp.title, "題");
  assert.deepEqual(rejected.map((r) => [r.fieldPath, r.problem.code]), [
    ["inApp.body", "unknown_variable"],
    ["inApp.title", "not_editable"],
  ]);
  // 元の定義は変えない
  assert.equal((resolved.content as Record<string, Record<string, unknown>>).email.subject, "{{name}} 様へ");
  assert.equal(applyAdminFieldValues(resolved, []).resolved, resolved);
});
