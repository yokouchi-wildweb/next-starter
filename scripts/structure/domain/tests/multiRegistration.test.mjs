// 登録の多いドメインの生成(D336: 生成の単位 = ドメインの中の登録 1 件)。1 つのフォルダに生成する登録が 2 つ(shop・shopItem)あるとき、
// 登録ごとの一式が登録の名前で書かれてぶつからず、import の道はドメインのフォルダ(@/domains/shop/…)を指し、ドメインに 1 つの物は同じ中身で 1 つ
// 実行: pnpm test scripts/structure/domain/tests/multiRegistration.test.mjs
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { ALL_GENERATE_OPTIONS } from "../spec/categories.mjs";
import { createWorkspace } from "../domain/workspace.mjs";
import { planGenerateAll } from "../pipeline/generateAll.mjs";
import { makeProject, removeAll } from "./helpers.mjs";

const cleanup = [];
after(() => removeAll(cleanup));

const SILENT = { log() {}, warn() {} };
const shop = { label: "店", singular: "shop", plural: "shops", dbEngine: "Neon", idType: "uuid", useCreatedAt: true, useUpdatedAt: true, fields: [{ name: "name", label: "名前", fieldType: "string", formInput: "textInput" }] };
const shopItem = { singular: "shop_item", plural: "shop_items", dbEngine: "Neon", idType: "uuid", useCreatedAt: true, useUpdatedAt: true, fields: [{ name: "title", label: "題", fieldType: "string", formInput: "textInput" }] };

function project() {
  const root = makeProject({ templates: ["."], configs: { shop }, cleanup });
  const itemDir = path.join(root, "src", "domains", "shop", "entities", "shopItem");
  fs.mkdirSync(itemDir, { recursive: true });
  fs.writeFileSync(path.join(itemDir, "entity.json"), JSON.stringify(shopItem));
  return root;
}

// 管理画面のルート(src/app/admin/_template)は一時の木に写さないので外す
const GEN = { ...ALL_GENERATE_OPTIONS, adminRoutes: false };

test("生成の単位は登録ごと: 主が先、登録の一式は登録の名前で、ドメインに 1 つの物は同じ中身", () => {
  const root = project();
  const workspace = createWorkspace(root);
  assert.deepEqual(workspace.generationUnitsOf("shop"), ["shop", "shopItem"]);
  const { plans } = planGenerateAll(workspace, ["shop"], GEN, null, SILENT);
  assert.deepEqual(plans.map((plan) => plan.domain), ["shop", "shop/shopItem"]);
  const rel = (output) => path.relative(root, output.path).split(path.sep).join("/");
  const [own, item] = plans.map((plan) => new Map(plan.outputs.filter((o) => o.kind === "file" || o.kind === "writeOnce").map((o) => [rel(o), o.content])));
  for (const file of [
    "src/domains/shop/entities/shopItem/drizzle.ts",
    "src/domains/shop/services/server/shopItemBase.ts",
    "src/domains/shop/services/server/shopItemService.ts",
    "src/domains/shop/shopItemPresenters.ts",
    "src/domains/shop/hooks/useShopItemList.ts",
    "src/domains/shop/services/client/shopItemClient.ts",
  ]) {
    assert.ok(item.has(file), `${file} が登録 shopItem の一式に無い`);
  }
  // ぶつからない: 両方に出るのはドメインに 1 つの物だけ、中身は同じ
  const shared = [...item.keys()].filter((file) => own.has(file));
  for (const file of shared) assert.equal(item.get(file), own.get(file), `${file} の中身が登録ごとに違う`);
  assert.ok(shared.every((file) => /\/entities\/index\.ts$|\/seed\.ts$|\/wrappers\//.test(file)), `ぶつかる: ${shared.join(", ")}`);
});

test("登録の一式の import はドメインのフォルダを指し、名前は登録の物", () => {
  const root = project();
  const workspace = createWorkspace(root);
  const { plans } = planGenerateAll(workspace, ["shop"], GEN, null, SILENT);
  const item = plans.find((plan) => plan.domain === "shop/shopItem");
  const base = item.outputs.find((o) => o.path.endsWith("shopItemBase.ts")).content;
  assert.match(base, /from "@\/domains\/shop\/entities\/shopItem\/entity\.json"/);
  assert.match(base, /export const shopItemBase = createCrudService\(ShopItemTable,/);
  const texts = item.outputs.filter((o) => typeof o.content === "string").map((o) => o.content).join("\n");
  assert.doesNotMatch(texts, /@\/domains\/shopItem\//, "登録名のフォルダを指す import が無い");
  const service = item.outputs.find((o) => o.path.endsWith("shopItemService.ts")).content;
  assert.match(service, /import \{ shopItemBase \} from "\.\/shopItemBase";/);
});

test("生成しない登録(generate: false)には何も書かない", () => {
  const root = project();
  const itemPath = path.join(root, "src", "domains", "shop", "entities", "shopItem", "entity.json");
  fs.writeFileSync(itemPath, JSON.stringify({ ...shopItem, generate: false }));
  const workspace = createWorkspace(root);
  assert.deepEqual(workspace.generationUnitsOf("shop"), ["shop"]);
  const { plans } = planGenerateAll(workspace, ["shop"], GEN, null, SILENT);
  assert.deepEqual(plans.map((plan) => plan.domain), ["shop"]);
});

test("Firestore の登録も登録のフォルダに書き、ドメインの物でない登録も生成でき、コレクションの道は <登録名>CollectionPath", () => {
  const room = { singular: "room", plural: "rooms", dbEngine: "Firestore", idType: "uuid", useCreatedAt: true, useUpdatedAt: true, fields: [{ name: "name", label: "名前", fieldType: "string", formInput: "textInput" }] };
  const root = makeProject({ templates: ["."], configs: { room }, registrations: { "room/roomNote": { ...room, singular: "room_note", plural: "room_notes" } }, cleanup });
  const workspace = createWorkspace(root);
  const { plans } = planGenerateAll(workspace, ["room"], { ...GEN, adminRoutes: false }, null, SILENT);
  assert.deepEqual(plans.map((plan) => plan.domain), ["room", "room/roomNote"]);
  const rel = (output) => path.relative(root, output.path).split(path.sep).join("/");
  const files = new Map(plans.flatMap((plan) => plan.outputs.filter((o) => o.kind === "file")).map((o) => [rel(o), o.content]));
  for (const registration of ["room", "roomNote"]) {
    for (const kind of ["firestore", "schema", "form", "model"]) assert.ok(files.has(`src/domains/room/entities/${registration}/${kind}.ts`), `${registration}/${kind}.ts`);
    assert.ok(!files.has(`src/domains/room/entities/${registration}/drizzle.ts`));
  }
  assert.match(files.get("src/domains/room/entities/roomNote/firestore.ts"), /^export const roomNoteCollectionPath = "room_notes";$/m);
  assert.ok(!files.has("src/domains/room/entities/firestore.ts"), "ドメインの直下には書かない(集める入口は pnpm generate registry)");
});
