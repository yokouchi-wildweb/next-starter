// pnpm generate domain のシードの雛形 <ドメイン>/seed.ts: 無いときだけ書き(write-once)、既にあれば触らない。列の名前と $unique の行の例を添える。
// Firestore のドメインは出さない(表名で引けない)。
// 実行: pnpm test scripts/structure/domain/tests/seedTemplate.test.mjs
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { renderSeed } from "../render/seed/index.mjs";
import { applyAndCapture, contextFor, makeProject, removeAll } from "./helpers.mjs";

const cleanup = [];
after(() => removeAll(cleanup));

const base = {
  domainConfigVersion: "1.3",
  singular: "shop_item",
  plural: "shop_items",
  label: "商品",
  dbEngine: "Neon",
  idType: "uuid",
  fields: [
    { name: "title", label: "名前", fieldType: "string", formInput: "textInput" },
    { name: "secret_note", label: "メモ", fieldType: "string", formInput: "none" },
  ],
};

const seedPath = (root) => path.join(root, "src/features/shopItem/seed.ts");
const run = (root) => {
  const { ctx } = contextFor(root, "shopItem");
  return applyAndCapture(renderSeed(ctx));
};

test("無ければ書く: 表名・列(formInput none は除く)・$unique の行の例・server-only・defineSeed", () => {
  const root = makeProject({ configs: { shopItem: base }, cleanup });
  run(root);
  const body = fs.readFileSync(seedPath(root), "utf8");
  assert.match(body, /^\/\/ src\/features\/shopItem\/seed\.ts/);
  assert.match(body, /import "server-only";/);
  assert.match(body, /export const seed = defineSeed\(\{/);
  assert.match(body, /\n    shop_items: \[\n/);
  assert.match(body, /\/\/ 列: title\n/);
  assert.match(body, /\$unique: \["title"\]/);
});

test("既にあれば触らない(write-once)", () => {
  const root = makeProject({ configs: { shopItem: base }, cleanup });
  fs.mkdirSync(path.dirname(seedPath(root)), { recursive: true });
  fs.writeFileSync(seedPath(root), "// 手で書いたシード\n");
  run(root);
  assert.equal(fs.readFileSync(seedPath(root), "utf8"), "// 手で書いたシード\n");
});

test("Firestore のドメインには出さない", () => {
  const root = makeProject({ configs: { shopItem: { ...base, dbEngine: "Firestore" } }, cleanup });
  run(root);
  assert.equal(fs.existsSync(seedPath(root)), false);
});
