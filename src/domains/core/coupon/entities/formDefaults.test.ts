// src/domains/core/coupon/entities/formDefaults.test.ts
// coupon のフォームの既定値(@/lib/formSuite の buildFormDefaultValues)が、画面の写し(display.ts の domainDisplay)からでも
// domain.json からでも同じになるか、作成フォームの既定値が作成の schema を通るか。lib はドメインを読まないので、ドメインの側に置く
// 実行: pnpm test src/domains/core/coupon/entities/formDefaults.test.ts

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { normalizeDomainJsonConfig } from "@/lib/domain";
import { buildFormDefaultValues } from "@/lib/formSuite";

import domainConfig from "../domain.json";
import { domainDisplay } from "./display";
import { CouponCreateSchema } from "./schema";

describe("coupon: buildFormDefaultValues は写しを受け取る", () => {
  const normalized = normalizeDomainJsonConfig(domainConfig as Record<string, unknown>) as Parameters<typeof buildFormDefaultValues>[0];

  test("作成の既定値が domain.json と同じ", () => {
    assert.deepEqual(buildFormDefaultValues(domainDisplay), buildFormDefaultValues(normalized));
  });

  test("編集の既定値が domain.json と同じ", () => {
    const entity = { id: "x", name: "n", updated_at: "2026-01-01T00:00:00Z" };
    assert.deepEqual(buildFormDefaultValues(domainDisplay, entity), buildFormDefaultValues(normalized, entity));
  });
});

describe("coupon: 作成フォームの既定値が schema を通る", () => {
  test("カテゴリ未選択でも settings（jsonb）が {} として通る", () => {
    const values = buildFormDefaultValues(domainConfig);
    const result = CouponCreateSchema.safeParse({
      ...values,
      code: "TEST",
      type: "official",
      status: "active",
      name: "テスト",
      current_total_uses: 0,
    });
    const settingsIssues = result.error?.issues.filter((issue) => issue.path[0] === "settings") ?? [];
    assert.deepEqual(settingsIssues, []);
    if (result.success) assert.deepEqual(result.data.settings, {});
  });
});
