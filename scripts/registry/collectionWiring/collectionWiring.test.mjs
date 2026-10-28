// 集まりの配線の突き合わせテスト: domain.json の集まりの項目と、serviceRegistry から読み込んだ主のサービスの collectionFields。
// 実行: pnpm test:collection-wiring（test:service-registry と同じく tsx + serverOnlyStub で登録表と各サービスを実際に読み込む）
// DB 未設定（DATABASE_URL が空）でも通る（サービスの生成は DB に繋がない）
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compareCollectionWiring, declaredCollections } from "./compare.mjs";
import { serviceRegistry } from "../../../src/registry/serviceRegistry.ts";
import { collectionFieldsOf } from "../../../src/lib/dataMigration/collectionFields.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("突き合わせ: 項目が足りない・余分・登録が無い主を出し、一致すれば空", () => {
  const declared = new Map([["album", ["photos", "tags"]], ["shop", ["images"]]]);
  const problems = compareCollectionWiring({
    declared,
    wired: new Map([["album", ["photos", "legacy"]], ["shop", null], ["plain", []]]),
  });
  assert.equal(problems.length, 3);
  assert.match(problems[0], /album: 集まりの項目 tags がサービスに配線されていない.*import \{ collections \} from "\.\/collections"/);
  assert.match(problems[1], /album: サービスの collections に domain\.json に無い項目 legacy がある/);
  assert.match(problems[2], /shop: serviceRegistry に登録が無い/);
  assert.deepEqual(compareCollectionWiring({ declared, wired: new Map([["album", ["tags", "photos"]], ["shop", ["images"]]]) }), []);
  assert.deepEqual(compareCollectionWiring({ declared: new Map(), wired: new Map([["plain", []]]) }), []);
});

test("このリポ: domain.json の集まりの項目は、登録表の主のサービスの collectionFields と一致する", async () => {
  const declared = declaredCollections(repoRoot);
  const wired = new Map();
  for (const [key, entry] of Object.entries(serviceRegistry)) {
    wired.set(key, collectionFieldsOf(await entry.service()));
  }
  for (const domain of declared.keys()) if (!wired.has(domain)) wired.set(domain, null);
  assert.deepEqual(compareCollectionWiring({ declared, wired }), []);
});
