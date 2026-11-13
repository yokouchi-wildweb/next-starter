// 送る口の管理画面の文言(resolveDefinition の adminOverrides)の検査
// - 門が開: 管理画面の値 > fork の override > 上流の既定(欄ごと)。定義ごとに 1 回だけ読む
// - 門が閉・adminEditable が無い連絡: 読まない、コードの値のまま
// - 通らない欄(直せなくなった・型・並びの数・使えない {{鍵}}・秘密の鍵)はその欄だけコードの値
// 実行: pnpm test src/features/core/messaging/services/server/sendMessage/adminOverrides.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import { defineMessage, secretVar, type MessageEnricher, type MessageRegistry } from "@/lib/messaging";

import { resolveDefinition } from "./definition";
import { TEST_CATEGORIES } from "./testHelpers";

const categories = TEST_CATEGORIES;

const definition = defineMessage({
  key: "shop.notice",
  category: "shop",
  vars: z.object({ name: z.string(), token: secretVar(z.string()) }),
  adminEditable: ["email.subject", "email.heading", "email.paragraphs", "inApp.body"],
  content: {
    email: { subject: "上流の件名", heading: "上流の見出し", paragraphs: ["一", "二"], cta: { label: "開く", url: "{{token}}" } },
    inApp: { title: "題", body: "上流の本文" },
  },
});

const registry: MessageRegistry = {
  "shop.notice": {
    key: "shop.notice",
    definition: async () => ({ message: definition }),
    override: async () => ({ messageOverride: { content: { email: { subject: "fork の件名", heading: "fork の見出し" } } } }),
  },
} as unknown as MessageRegistry;

const enrichers: Record<string, MessageEnricher> = {
  displayName: {
    key: "displayName",
    messages: ["shop.notice"],
    provides: z.object({ displayName: z.string() }),
    resolve: () => ({ displayName: "x" }),
  },
};

function source(open: boolean, values: { fieldPath: string; value: unknown }[]) {
  const loads: string[] = [];
  return {
    loads,
    adminOverrides: {
      enabled: () => open,
      load: async (key: string) => {
        loads.push(key);
        return values;
      },
    },
  };
}

const emailOf = (resolved: { content: unknown }) => (resolved.content as Record<string, Record<string, unknown>>).email;
const inAppOf = (resolved: { content: unknown }) => (resolved.content as Record<string, Record<string, unknown>>).inApp;

test("門が開: 管理画面 > fork の override > 上流、1 回だけ読む", async () => {
  const { loads, adminOverrides } = source(true, [
    { fieldPath: "email.subject", value: "管理の件名 {{displayName}}" },
    { fieldPath: "inApp.body", value: "管理の本文 {{name}}" },
  ]);
  const resolved = await resolveDefinition(definition, { registry: registry, channels: {}, enrichers: enrichers, categories, adminOverrides: adminOverrides });
  assert.equal(emailOf(resolved).subject, "管理の件名 {{displayName}}");
  assert.equal(emailOf(resolved).heading, "fork の見出し");
  assert.deepEqual(emailOf(resolved).paragraphs, ["一", "二"]);
  assert.equal(inAppOf(resolved).body, "管理の本文 {{name}}");
  assert.deepEqual(loads, ["shop.notice"]);
});

test("門が閉・読み口なし: DB の値を使わない(読まない)", async () => {
  const closed = source(false, [{ fieldPath: "email.subject", value: "管理の件名" }]);
  const resolved = await resolveDefinition(definition, { registry: registry, channels: {}, enrichers: enrichers, categories, adminOverrides: closed.adminOverrides });
  assert.equal(emailOf(resolved).subject, "fork の件名");
  assert.deepEqual(closed.loads, []);
  assert.equal(emailOf(await resolveDefinition(definition, { registry: registry, channels: {}, enrichers: enrichers, categories })).subject, "fork の件名");
});

test("adminEditable の無い連絡は読まない", async () => {
  const plain = defineMessage({
    key: "shop.plain",
    category: "shopEmail",
    vars: z.object({}),
    content: { email: { subject: "件名" } },
  });
  const { loads, adminOverrides } = source(true, [{ fieldPath: "email.subject", value: "x" }]);
  const resolved = await resolveDefinition(plain, { registry: {} as MessageRegistry, channels: {}, enrichers: {}, categories, adminOverrides: adminOverrides });
  assert.equal(emailOf(resolved).subject, "件名");
  assert.deepEqual(loads, []);
});

test("通らない欄はその欄だけコードの値(空で送らない)", async () => {
  const warn = console.warn;
  const warnings: string[] = [];
  console.warn = (message: string) => warnings.push(message);
  try {
    const { adminOverrides } = source(true, [
      { fieldPath: "email.subject", value: "{{token}} 秘密" },
      { fieldPath: "email.heading", value: 3 },
      { fieldPath: "email.paragraphs", value: ["一つだけ"] },
      { fieldPath: "inApp.title", value: "直せない欄" },
      { fieldPath: "inApp.body", value: "{{unknownKey}}" },
      { fieldPath: "email.cta", value: { label: "x", url: "https://evil.test" } },
    ]);
    const resolved = await resolveDefinition(definition, { registry: registry, channels: {}, enrichers: enrichers, categories, adminOverrides: adminOverrides });
    assert.equal(emailOf(resolved).subject, "fork の件名");
    assert.equal(emailOf(resolved).heading, "fork の見出し");
    assert.deepEqual(emailOf(resolved).paragraphs, ["一", "二"]);
    assert.deepEqual(emailOf(resolved).cta, { label: "開く", url: "{{token}}" });
    assert.equal(inAppOf(resolved).title, "題");
    assert.equal(inAppOf(resolved).body, "上流の本文");
    assert.equal(warnings.length, 6);
  } finally {
    console.warn = warn;
  }
});
