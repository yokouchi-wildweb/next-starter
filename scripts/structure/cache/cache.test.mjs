// scripts/structure/cache のテスト(仮の木で宣言 → cachedReads.ts、消去・問題・手書きの base・check の食い違い)。
// 実行: pnpm test scripts/structure/cache/cache.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { CACHED_READS_FILE, checkCachedReads, generateCachedReads, planCachedReads, renderCachedReads } from "./lib.mjs";
import { buildCacheTagsOption } from "../domain/render/serverServices/templateTweaks.mjs";

const neon = { singular: "post", dbEngine: "Neon", fields: [{ name: "title" }, { name: "is_published" }] };
const BASE_OK = 'export const postBase = createCrudService(PostTable, {\n  ...baseOptions,\n  cacheTags: { domain: "post" },\n});\n';

/** 仮の木を作って fn(root, rows) を走らせ、消す */
function withTree(files, rows, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cache-gen-"));
  try {
    for (const [rel, value] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), typeof value === "string" ? value : JSON.stringify(value));
    }
    return fn(root, rows);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
/** 仮の木のドメインの宣言: domain.json と主の登録の entities/<フォルダ名>/entity.json(本文 entity) */
const declared = (folder, entity) => {
  const name = folder.split("/").at(-1);
  return { [`${folder}/domain.json`]: { domainConfigVersion: "2.0" }, [`${folder}/entities/${name}/entity.json`]: entity };
};
const postRow = { kind: "domains", name: "post", dir: "src/domains/post", domainJson: true };
const tagRow = { kind: "domains", name: "tag", dir: "src/domains/core/tag", domainJson: false };
const userRow = { kind: "domains", name: "user", dir: "src/domains/core/user", domainJson: false };

test("render: tagged の get は行のキャッシュタグ・行の全部のキャッシュタグ・読むドメインのキャッシュタグ、list と名前付きの読みはドメインのキャッシュタグ、ttl はキャッシュタグなし", () => {
  const text = renderCachedReads(
    postRow,
    {
      mode: "tagged",
      life: "days",
      list: { limit: 100 },
      reads: [
        { name: "published", where: { field: "isPublished", op: "eq", value: true }, orderBy: [["createdAt", "DESC"]], limit: 20 },
        { name: "fresh", limit: 5, mode: "ttl", life: { revalidate: 60, expire: 600 } },
      ],
      readsDomains: ["user"],
    },
    "src/domains/post/entities/post/entity.json",
  );
  assert.match(text, /^\/\/ 生成物・編集不可: pnpm generate cache が src\/domains\/post\/entities\/post\/entity\.json の cache から生成する/);
  assert.match(text, /async function cachedGet\(id: string\) \{\n {2}"use cache: remote";\n {2}cacheLife\("days"\);\n {2}cacheTag\(cacheTagOf\("post", id\), cacheRowsTagOf\("post"\), cacheTagOf\("user"\)\);\n {2}return postBase\.get\(id\);/);
  assert.match(text, /const get = \(id: string\) => readThrough\("post\.get", \(\) => cachedGet\(id\), \(\) => postBase\.get\(id\)\);/);
  assert.match(text, /async function cachedList\(\) \{[\s\S]*?cacheTag\(cacheTagOf\("post"\), cacheTagOf\("user"\)\);\n {2}return postBase\.search\(\{ limit: 100 \}\);/);
  assert.match(text, /return postBase\.search\(\{ where: \{ field: "isPublished", op: "eq", value: true \}, orderBy: \[\["createdAt", "DESC"\]\], limit: 20 \}\);/);
  assert.match(text, /async function cachedFresh\(\) \{\n {2}"use cache: remote";\n {2}cacheLife\(\{ revalidate: 60, expire: 600 \}\);\n {2}return postBase\.search\(\{ limit: 5 \}\);/);
  assert.match(text, /import \{ cacheLife, cacheTag \} from "next\/cache";\nimport \{ cacheRowsTagOf, cacheTagOf, readThrough \} from "@\/lib\/cacheTags\/server";/);
  assert.match(text, /export const postCachedReads = \{ get, list, published, fresh \};/);
});

test("render: ttl だけ・get: false はキャッシュタグの import も get も出さない", () => {
  const ttl = renderCachedReads(postRow, { mode: "ttl", life: "minutes" }, "x");
  assert.match(ttl, /import \{ cacheLife \} from "next\/cache";\nimport \{ readThrough \} from "@\/lib\/cacheTags\/server";\n\nimport \{ postBase \}/);
  assert.doesNotMatch(ttl, /cacheTag\(/);
  assert.match(ttl, /export const postCachedReads = \{ get \};/);
  const noGet = renderCachedReads(postRow, { mode: "tagged", life: "hours", get: false, list: { limit: 10 } }, "x");
  assert.doesNotMatch(noGet, /cachedGet|cacheRowsTagOf/);
  assert.match(noGet, /import \{ cacheTagOf, readThrough \} from "@\/lib\/cacheTags\/server";/);
  assert.match(noGet, /export const postCachedReads = \{ list \};/);
});

test("generate: entity.json と cache.json(手書きのドメイン)の両方に書き、2 回目は何もしない、check は宣言どおり", () => {
  const files = {
    ...declared("src/domains/post", { ...neon, generate: false, cache: { mode: "tagged", life: "days" } }),
    "src/domains/post/services/server/postBase.ts": BASE_OK,
    "src/domains/core/tag/cache.json": { mode: "ttl", life: "minutes", get: false, list: { limit: 50 } },
    "src/domains/core/tag/services/server/tagBase.ts": BASE_OK.replace('"post"', '"tag"').replace("postBase", "tagBase"),
    "src/domains/core/user/services/server/userBase.ts": "export const userBase = {};\n",
  };
  withTree(files, [postRow, tagRow, userRow], (root, rows) => {
    const plan = planCachedReads(root, rows);
    assert.deepEqual(plan.problems, []);
    assert.deepEqual(plan.writes.map((w) => w.path), [path.join("src/domains/post", CACHED_READS_FILE), path.join("src/domains/core/tag", CACHED_READS_FILE)]);
    for (const { path: rel, content } of plan.writes) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), content);
    }
    assert.deepEqual(planCachedReads(root, rows).removes, []);
    assert.match(fs.readFileSync(path.join(root, "src/domains/core/tag", CACHED_READS_FILE), "utf8"), /pnpm generate cache が src\/domains\/core\/tag\/cache\.json の cache から/);
  });
});

test("消去: 宣言が消えたドメインの印のある cachedReads.ts だけを消す、check は食い違いを名指す", () => {
  const generated = "// 生成物・編集不可: pnpm generate cache が x の cache から生成する\n";
  const files = {
    ...declared("src/domains/post", neon),
    [path.join("src/domains/post", CACHED_READS_FILE)]: generated,
    [path.join("src/domains/core/user", CACHED_READS_FILE)]: "// 手書き\n",
  };
  withTree(files, [postRow, userRow], (root, rows) => {
    const plan = planCachedReads(root, rows);
    assert.deepEqual(plan.removes, [path.join("src/domains/post", CACHED_READS_FILE)]);
    assert.deepEqual(plan.writes, []);
  });
});

test("問題: 宣言の誤り・手書きの土台に cacheTags が無い・土台(<登録名>Base.ts)が無い は何も書かない", () => {
  const bad = declared("src/domains/post", { ...neon, cache: { mode: "tagged", life: "default" } });
  withTree(bad, [postRow], (root, rows) => {
    const plan = planCachedReads(root, rows);
    assert.match(plan.problems.join("\n"), /\[post\] cache\.life に "default" は書けません/);
    assert.deepEqual(plan.writes, []);
  });
  const noOption = {
    ...declared("src/domains/post", { ...neon, cache: { mode: "tagged", life: "days" } }),
    "src/domains/post/services/server/postBase.ts": "export const postBase = createCrudService(PostTable, { ...baseOptions });\n",
    "src/domains/core/tag/cache.json": { mode: "tagged", life: "days" },
  };
  withTree(noOption, [postRow, tagRow], (root, rows) => {
    const plan = planCachedReads(root, rows);
    const text = plan.problems.join("\n");
    assert.match(text, /\[post\] .*cacheTags: \{ domain: "post" \} を書いてください/);
    assert.match(text, /\[tag\] src\/domains\/core\/tag\/services\/server\/tagBase\.ts がありません/);
    assert.deepEqual(plan.writes, []);
  });
});

test("入口: 実の木の宣言 0 では generate は何も書かず、check は通る", () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
  const checked = checkCachedReads(root);
  assert.equal(checked.ok, true, checked.lines.join("\n"));
  assert.ok(typeof generateCachedReads === "function");
});

test("domain の生成器: cache の宣言があれば <登録名>Base の option に cacheTags、無ければ出さない", () => {
  assert.equal(buildCacheTagsOption("post", undefined), "");
  assert.match(buildCacheTagsOption("post", { mode: "tagged", life: "days" }), /^ {2}\/\/ .*\n {2}cacheTags: \{ domain: "post" \},\n$/);
});
