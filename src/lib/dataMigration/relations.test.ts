// src/lib/dataMigration/relations.test.ts
// collectExportDomains: 設定は注入で受け、並びは related → main → hasMany → junction

import assert from "node:assert/strict";
import { test } from "node:test";

import type { DomainConfig } from "@/lib/domain/types/domainConfig";

import { collectExportDomains } from "./relations";

const configs: Record<string, DomainConfig> = {
  sample: {
    singular: "sample",
    label: "サンプル",
    fields: [{ name: "name", label: "名前", fieldType: "string" }],
    relations: [
      { domain: "sample_category", label: "カテゴリ", fieldName: "sample_category_id", fieldType: "uuid", relationType: "belongsTo" },
      { domain: "sample_tag", label: "タグ", fieldName: "sample_tag_ids", fieldType: "uuid[]", relationType: "belongsToMany" },
      { domain: "sample_image", label: "画像", fieldName: "sample_id", relationType: "hasMany" },
    ],
  },
  sample_category: { singular: "sampleCategory", label: "カテゴリ", fields: [] },
  sample_tag: { singular: "sampleTag", label: "タグ", fields: [] },
  sample_image: { singular: "sampleImage", label: "画像", fields: [] },
};
const lookup = (domain: string) => configs[domain];

test("関連を含まないときは main だけ", () => {
  assert.deepEqual(collectExportDomains(lookup, "sample").map((d) => [d.domain, d.type]), [["sample", "main"]]);
});

test("関連を含むときの並びと、選ばれた hasMany だけ", () => {
  const types = collectExportDomains(lookup, "sample", true, ["sample_image"]).map((d) => [d.domain, d.type]);
  assert.deepEqual(types, [
    ["sample_category", "related"],
    ["sample_tag", "related"],
    ["sample", "main"],
    ["sample_image", "hasMany"],
    ["sample_to_sample_tag", "junction"],
  ]);
  assert.equal(collectExportDomains(lookup, "sample", true).some((d) => d.type === "hasMany"), false);
});
