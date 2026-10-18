// src/lib/domain/relations/relationOptions.mjs の検査。実行: pnpm test:relation-options
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  domainsFromRelationOptionsKey,
  getFormRelations,
  getStaticRelations,
  relationOptionsKey,
} from "./relationOptions.mjs";

const config = {
  relations: [
    { domain: "sample_category", relationType: "belongsTo" },
    { domain: "sample_tag", relationType: "belongsToMany", includeRelationTable: true, formInput: "asyncMultiSelect" },
    { domain: "prize_item", relationType: "belongsToMany", includeRelationTable: false },
    { domain: "user", relationType: "belongsTo", formInput: "asyncCombobox" },
    { domain: "color", relationType: "belongsTo", formInput: "custom" },
    { domain: "owner", relationType: "belongsTo", formInput: "combobox" },
    { domain: "child", relationType: "hasMany" },
    { domain: "profile", relationType: "hasOne" },
  ],
};

test("getFormRelations: belongsTo と表側の belongsToMany だけ(hasMany / hasOne / 逆側は出ない)", () => {
  assert.deepEqual(
    getFormRelations(config).map((r) => r.domain),
    ["sample_category", "sample_tag", "user", "color", "owner"],
  );
});

test("getStaticRelations: フォームに出る関連のうち async と custom を除く(順序は domain.json のまま)", () => {
  assert.deepEqual(getStaticRelations(config).map((r) => r.domain), ["sample_category", "owner"]);
  assert.deepEqual(getStaticRelations({}), []);
  assert.deepEqual(getStaticRelations({ relations: [] }), []);
});

test("relationOptionsKey: 文字列キー。関連が無ければ null。domainsFromRelationOptionsKey で元に戻る", () => {
  const key = relationOptionsKey(getStaticRelations(config));
  assert.equal(key, "relationOptions:sample_category,owner");
  assert.deepEqual(domainsFromRelationOptionsKey(key), ["sample_category", "owner"]);
  assert.equal(relationOptionsKey([]), null);
  assert.deepEqual(domainsFromRelationOptionsKey("relationOptions:"), []);
  assert.deepEqual(domainsFromRelationOptionsKey("sampleCategories"), [], "別のキーは空");
});
