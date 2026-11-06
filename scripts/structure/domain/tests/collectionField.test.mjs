// 主の集まりの項目（mediaCollection）の純関数（従属の既定の名前・snake_case の判定）の回帰テスト。
// 実行: pnpm test scripts/structure/domain/tests/collectionField.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultChildName, isSnakeCaseName } from "../spec/collectionField.mjs";

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

test("従属の名前の検査は snake_case", () => {
  for (const ok of ["sample_image", "a", "photo2", "card_set_image"]) assert.equal(isSnakeCaseName(ok), true, ok);
  for (const ng of ["", "SampleImage", "sample-image", "_x", "x_", "2x", "sample__image"]) assert.equal(isSnakeCaseName(ng), false, ng);
});
