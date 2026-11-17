// 管理画面の欄の値(文言の上書き、D132)の直せる欄・検査・重ね方・改版での移し方
// - 直せる欄: 既定 = ひな形の欄のうち種類の経路で使う物の全部、adminEditableOnly で絞る、functional・required の連絡は無い
// - 検査: 直せる欄の外・欄の型(必須は空にできない)・知らない {{鍵}}・秘密の vars を落とす。並び・ブロックは欄ごと丸ごと
// - 改版: 保存した版から今の版へ欄の道を移す。移せない(捨てた欄・段の対応が無い・版の無い古い形の行)= unusable
// - 重ね方: 当てられる行だけ values に重ね、当てられない行はコードの値のまま rejected で返す
// 実行: pnpm test src/lib/messaging/definition/adminFields.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import { defineMessageLayout, type MessageLayout } from "../layout/types";
import { MESSAGE_BLOCK_KINDS } from "../layout/blocks";
import { resolveMessageDefinition } from "./validate";
import { defineMessage } from "./defineMessage";
import { secretVar } from "./secret";
import {
  adminEditableFields,
  adminFieldAllowedKeys,
  adminFieldCodeValue,
  applyAdminFieldValues,
  checkAdminFieldValue,
  moveAdminFieldPath,
} from "./adminFields";

/** 件名 + ブロック + メールだけの欄(版 1) */
const LAYOUT = defineMessageLayout({
  key: "notice",
  label: "お知らせ",
  fields: {
    subject: { type: "line", label: "件名", required: true },
    blocks: { type: "blocks", label: "本文", allow: MESSAGE_BLOCK_KINDS },
    preheader: { type: "line", label: "プリヘッダー", channels: ["email"] },
  },
  summary: (values) => ({ title: values.subject ?? "", body: "" }),
}) as MessageLayout;

/** 版 3: 版 1 → 2 で subject を title へ、版 2 → 3 で preheader を捨てた */
const LAYOUT_V3 = defineMessageLayout({
  key: "notice",
  label: "お知らせ",
  version: 3,
  revisions: { 1: { subject: "title" }, 2: { preheader: null } },
  fields: {
    title: { type: "line", label: "題", required: true },
    blocks: { type: "blocks", label: "本文", allow: MESSAGE_BLOCK_KINDS },
  },
  summary: (values) => ({ title: values.title ?? "", body: "" }),
}) as MessageLayout;

const definition = defineMessage({
  key: "shop.notice",
  label: "テストの連絡",
  category: "shop",
  vars: z.object({ name: z.string(), token: secretVar(z.string()) }),
  layout: "notice",
  values: { subject: "{{name}} 様へ", blocks: [{ type: "paragraph", text: "一" }] },
});
const resolve = (over: Record<string, unknown> = {}, category = { kind: "transactional" as const, channels: ["email", "inApp"] }) =>
  resolveMessageDefinition({ ...definition, ...over } as typeof definition, undefined, category);

test("直せる欄: 既定は種類の経路で使う欄の全部、adminEditableOnly で絞る、functional・required は無い", () => {
  assert.deepEqual(adminEditableFields(resolve(), LAYOUT), ["subject", "blocks", "preheader"]);
  // メールだけの欄は種類の経路に email が無ければ直せない
  assert.deepEqual(adminEditableFields(resolve({}, { kind: "transactional", channels: ["inApp"] }), LAYOUT), ["subject", "blocks"]);
  assert.deepEqual(adminEditableFields(resolve({ adminEditableOnly: ["subject"] }), LAYOUT), ["subject"]);
  assert.deepEqual(adminEditableFields(resolve({}, { kind: "functional", channels: ["email"] } as never), LAYOUT), []);
  assert.deepEqual(adminEditableFields(resolve({ required: true }), LAYOUT), []);
});

test("使ってよい鍵とコードの値", () => {
  const resolved = resolve();
  assert.deepEqual(adminFieldAllowedKeys(resolved, ["displayName"]), [
    "name",
    "recipientName",
    "recipientEmail",
    "serviceName",
    "appBaseUrl",
    "displayName",
  ]);
  assert.equal(adminFieldCodeValue(resolved, "subject"), "{{name}} 様へ");
  assert.equal(adminFieldCodeValue(resolved, "preheader"), undefined);
});

test("通る値と落ちる値(ブロックは欄ごと丸ごと、長さは問わない)", () => {
  const resolved = resolve({ adminEditableOnly: ["subject", "blocks"] });
  assert.equal(checkAdminFieldValue(resolved, LAYOUT, "subject", "{{recipientName}} {{name}} 様"), null);
  assert.equal(
    checkAdminFieldValue(resolved, LAYOUT, "blocks", [{ type: "heading", text: "見出し" }, { type: "paragraph", text: "a" }, { type: "paragraph", text: "b" }]),
    null,
  );
  const cases: [string, unknown, string][] = [
    ["preheader", "x", "not_editable"],
    ["nope", "x", "not_editable"],
    ["subject", "", "invalid_value"],
    ["subject", 3, "invalid_value"],
    ["subject", undefined, "invalid_value"],
    ["blocks", [{ type: "nope" }], "invalid_value"],
    ["subject", "{{nope}}", "unknown_variable"],
    ["subject", "{{token}}", "unknown_variable"],
    ["blocks", [{ type: "paragraph", text: "{{token}}" }], "unknown_variable"],
  ];
  for (const [path, value, code] of cases) {
    assert.equal(checkAdminFieldValue(resolved, LAYOUT, path, value)?.code, code, `${path} ${JSON.stringify(value)}`);
  }
  assert.equal(checkAdminFieldValue(resolved, LAYOUT, "subject", "{{displayName}}", { variableKeys: ["displayName"] }), null);
});

test("改版: 保存した版から今の版へ欄の道を移す。捨てた欄・段の無い版・版の無い古い形の行は移せない", () => {
  assert.deepEqual(moveAdminFieldPath(LAYOUT_V3, "subject", 1), { fieldPath: "title" });
  assert.deepEqual(moveAdminFieldPath(LAYOUT_V3, "title", 3), { fieldPath: "title" });
  assert.deepEqual(moveAdminFieldPath(LAYOUT_V3, "blocks", 2), { fieldPath: "blocks" });
  assert.ok("unusable" in moveAdminFieldPath(LAYOUT_V3, "preheader", 1), "捨てた欄");
  assert.ok("unusable" in moveAdminFieldPath(LAYOUT_V3, "title", 4), "今より新しい版");
  assert.ok("unusable" in moveAdminFieldPath(LAYOUT_V3, "email.subject", null), "版の無い古い形の行");
  assert.ok("unusable" in moveAdminFieldPath(LAYOUT, "email.subject", 1), "ひな形に無い欄");
  const broken = { ...LAYOUT_V3, revisions: { 1: { subject: "title" } } } as MessageLayout;
  assert.ok("unusable" in moveAdminFieldPath(broken, "blocks", 1), "段の対応が無い");
});

test("重ね方: 当てられる行だけ values に重ね(版を移して)、使えない・通らない行はコードの値のまま", () => {
  const resolved = resolveMessageDefinition(
    { ...definition, values: { title: "{{name}} 様へ", blocks: [{ type: "paragraph", text: "一" }] } } as typeof definition,
    undefined,
    { kind: "transactional", channels: ["email", "inApp"] },
  );
  const merged = applyAdminFieldValues(resolved, LAYOUT_V3, [
    { fieldPath: "subject", value: "直した題 {{name}}", layoutVersion: 1 },
    { fieldPath: "blocks", value: [{ type: "paragraph", text: "{{nope}}" }], layoutVersion: 3 },
    { fieldPath: "preheader", value: "捨てた欄", layoutVersion: 1 },
    { fieldPath: "email.subject", value: "古い形", layoutVersion: null },
  ]);
  assert.deepEqual(merged.applied, ["title"]);
  assert.deepEqual((merged.resolved.values as Record<string, unknown>).title, "直した題 {{name}}");
  assert.deepEqual((merged.resolved.values as Record<string, unknown>).blocks, [{ type: "paragraph", text: "一" }]);
  assert.deepEqual(
    merged.rejected.map((r) => [r.fieldPath, r.problem.code]),
    [
      ["blocks", "unknown_variable"],
      ["preheader", "unusable"],
      ["email.subject", "unusable"],
    ],
  );
  // 当てる行が無ければ同じ定義を返す
  assert.equal(applyAdminFieldValues(resolved, LAYOUT_V3, []).resolved, resolved);
});
