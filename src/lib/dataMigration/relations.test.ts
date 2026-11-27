// src/lib/dataMigration/relations.test.ts
// collectExportDomains: 設定は注入で受け、並びは related → main → hasMany → junction。結びは through を書いた持つ側だけ、表・列は結びの登録から(D354)

import assert from "node:assert/strict";
import { test } from "node:test";

import type { DomainConfig } from "@/lib/domain";

import { collectExportDomains } from "./relations";

const configs: Record<string, DomainConfig> = {
  sample: {
    singular: "sample",
    plural: "samples",
    label: "サンプル",
    fields: [{ name: "name", label: "名前", fieldType: "string" }],
    relations: [
      { domain: "sample_category", label: "カテゴリ", fieldName: "sample_category_id", fieldType: "uuid", relationType: "belongsTo" },
      { domain: "sample_tag", label: "タグ", fieldName: "sample_tag_ids", fieldType: "uuid[]", relationType: "belongsToMany", through: "sampleToSampleTag" },
      { domain: "sample_image", label: "画像", fieldName: "sample_id", relationType: "hasMany" },
    ],
  },
  sample_category: { singular: "sampleCategory", label: "カテゴリ", fields: [] },
  sample_tag: {
    singular: "sampleTag",
    plural: "sample_tags",
    label: "タグ",
    fields: [],
    relations: [{ domain: "sample", label: "サンプル", fieldName: "sample_ids", fieldType: "uuid[]", relationType: "belongsToMany" }],
  },
  // 結びの登録(手の表の形: 今の TS の名前 sampleId / sampleTagId、FK は表の名前で両側を指す)
  sample_to_sample_tag: {
    singular: "sample_to_sample_tag",
    plural: "sample_to_sample_tag",
    label: "サンプルとタグ",
    fields: [],
    foreignKeys: [
      { columns: ["sampleId"], references: { table: "samples", columns: ["id"] }, onDelete: "CASCADE" },
      { columns: ["sampleTagId"], references: { table: "sample_tags", columns: ["id"] }, onDelete: "CASCADE" },
    ],
  } as DomainConfig,
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

test("結びの表・列は through の結びの登録から読む(名前を組み立てない)、反対側は結びを出さない", () => {
  const junction = collectExportDomains(lookup, "sample", true).find((d) => d.type === "junction");
  assert.deepEqual([junction?.domain, junction?.sourceField, junction?.targetField], ["sample_to_sample_tag", "sampleId", "sampleTagId"]);
  const reverse = collectExportDomains(lookup, "sample_tag", true).map((d) => [d.domain, d.type]);
  assert.deepEqual(reverse, [["sample", "related"], ["sample_tag", "main"]]);
});
