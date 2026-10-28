// 主の集まりの項目（mediaCollection）の問いが使う純関数（既定の名前・項目の組み立て・型の選択肢の並び）の回帰テスト。
// 対話そのものは対象外（questions/fields/collection.mjs はこの関数で項目を組む）。
// 実行: pnpm test:dc-collection-field
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCollectionField, defaultChildName, fieldTypeChoices, isSnakeCaseName } from "../spec/collectionField.mjs";
import { vocabularyWarnings } from "../checks/vocabulary.mjs";

test("既定の名前: 項目名が s で終われば末尾の s を 1 つ外して singular、項目名のまま plural", () => {
  assert.deepEqual(defaultChildName("sample", "images"), { singular: "sample_image", plural: "sample_images" });
  assert.deepEqual(defaultChildName("sample", "main_photos"), { singular: "sample_main_photo", plural: "sample_main_photos" });
  assert.deepEqual(defaultChildName("card_set", "galleryImages"), { singular: "card_set_gallery_image", plural: "card_set_gallery_images" });
});

test("既定の名前: s で終わらなければ singular だけ（plural は推定に任せる）", () => {
  const name = defaultChildName("sample", "gallery");
  assert.deepEqual(name, { singular: "sample_gallery" });
  assert.equal(name.plural, undefined);
});

test("項目の組み立て: L2.4 の形（collection に plural は持たない）で、語彙の検査を警告なく通る", () => {
  const field = buildCollectionField({ name: "images", label: "画像", childSingular: "sample_image", required: false, maxItems: 10, reorderable: true, duplicate: false });
  assert.deepEqual(field, {
    name: "images",
    label: "画像",
    fieldType: "mediaCollection",
    formInput: "mediaUploaderMulti",
    required: false,
    reorderable: true,
    collection: { domain: "sample_image", maxItems: 10, duplicate: false },
  });
  const config = { singular: "sample", plural: "samples", dbEngine: "Neon", idType: "uuid", fields: [field] };
  assert.deepEqual(vocabularyWarnings(config), []);
});

test("項目の組み立て: 必須なら複製は常に true", () => {
  const field = buildCollectionField({ name: "images", label: "画像", childSingular: "sample_image", required: true, maxItems: 3, reorderable: false, duplicate: false });
  assert.equal(field.required, true);
  assert.deepEqual(field.collection, { domain: "sample_image", maxItems: 3, duplicate: true });
});

test("型の選択肢: Neon は mediaCollection が mediaUploaderMulti の直前、Firestore には無い", () => {
  const neon = fieldTypeChoices("Neon");
  assert.equal(neon.indexOf("mediaCollection") + 1, neon.indexOf("mediaUploaderMulti"));
  assert.equal(fieldTypeChoices("Firestore").includes("mediaCollection"), false);
  assert.deepEqual(fieldTypeChoices("Unknown"), []);
});

test("従属の名前の検査は snake_case", () => {
  for (const ok of ["sample_image", "a", "photo2", "card_set_image"]) assert.equal(isSnakeCaseName(ok), true, ok);
  for (const ng of ["", "SampleImage", "sample-image", "_x", "x_", "2x", "sample__image"]) assert.equal(isSnakeCaseName(ng), false, ng);
});
