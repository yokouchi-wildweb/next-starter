// src/domains/sample/entities/formDefaults.test.ts
// sample のフォームの既定値(@/lib/formSuite の buildFormDefaultValues)が、画面の写し(display.ts の domainDisplay)からでも
// domain.json からでも同じになるか、作成フォームの既定値が作成の schema を通るか。lib はドメインを読まないので、ドメインの側に置く
// 実行: pnpm test src/domains/sample/entities/formDefaults.test.ts

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { normalizeEntityDeclaration } from "@/lib/domain";
import { buildFormDefaultValues } from "@/lib/formSuite";

import domainConfig from "./sample/entity.json";
import { domainDisplay } from "./display";
import { SampleCreateSchema } from "./schema";

describe("sample: buildFormDefaultValues は写しを受け取る", () => {
  const normalized = normalizeEntityDeclaration(domainConfig as Record<string, unknown>) as Parameters<typeof buildFormDefaultValues>[0];

  test("作成の既定値が domain.json と同じ", () => {
    assert.deepEqual(buildFormDefaultValues(domainDisplay), buildFormDefaultValues(normalized));
  });

  test("編集の既定値が domain.json と同じ", () => {
    const entity = { id: "x", name: "n", updated_at: "2026-01-01T00:00:00Z" };
    assert.deepEqual(buildFormDefaultValues(domainDisplay, entity), buildFormDefaultValues(normalized, entity));
  });
});

describe("sample: 作成フォームの既定値が schema を通る", () => {
  test("画像の集まり（mediaCollection）が空でも通る", () => {
    const values = buildFormDefaultValues(normalizeEntityDeclaration(domainConfig));
    const result = SampleCreateSchema.safeParse({ ...values, name: "テスト" });
    assert.equal(result.success, true, JSON.stringify(result.error?.issues));
    assert.deepEqual(result.data?.images, []);
  });
});
