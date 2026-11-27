// scripts/structure/cache のテスト(仮の木で登録の宣言 → <登録名>CachedReads.ts、主でない登録・fork の上書き・消去・問題・手書きの base・check の食い違い)。
// 実行: pnpm test scripts/structure/cache/cache.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { cachedReadsFileOf, checkCachedReads, generateCachedReads, planCachedReads, renderCachedReads } from "./lib.mjs";
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

test("generate: 登録ごとに書く(主の登録・主でない登録・fork の上書きの cache が丸ごと差し替える)、2 回目は何もしない", () => {
  const files = {
    ...declared("src/domains/post", { ...neon, generate: false, cache: { mode: "tagged", life: "days" } }),
    "src/domains/post/services/server/postBase.ts": BASE_OK,
    // 主でない登録 postComment も自分の entity.json に(ドメインの既定を継がない)
    "src/domains/post/entities/postComment/entity.json": { ...neon, singular: "post_comment", cache: { mode: "ttl", life: "minutes", get: false, list: { limit: 50 } } },
    "src/domains/post/services/server/postCommentBase.ts": BASE_OK.replaceAll('"post"', '"postComment"').replace("postBase", "postCommentBase"),
    // fork の上書き: entity.override.ts の cache が entity.json の cache を丸ごと差し替える
    ...declared("src/domains/core/tag", { ...neon, singular: "tag", cache: { mode: "tagged", life: "days" } }),
    "src/domains/core/tag/entities/tag/entity.override.ts": 'export const entityOverride = { cache: { mode: "ttl", life: "minutes" } };\n',
    "src/domains/core/tag/services/server/tagBase.ts": BASE_OK.replaceAll('"post"', '"tag"').replace("postBase", "tagBase"),
  };
  const rows = [postRow, { ...tagRow, domainJson: true }, userRow];
  withTree(files, rows, (root) => {
    const plan = planCachedReads(root, rows);
    assert.deepEqual(plan.problems, []);
    assert.deepEqual(plan.writes.map((w) => w.path).sort(), [
      path.join("src/domains/core/tag", cachedReadsFileOf("tag")),
      path.join("src/domains/post", cachedReadsFileOf("post")),
      path.join("src/domains/post", cachedReadsFileOf("postComment")),
    ].sort());
    for (const { path: rel, content } of plan.writes) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), content);
    }
    assert.deepEqual(planCachedReads(root, rows).removes, []);
    const comment = fs.readFileSync(path.join(root, "src/domains/post", cachedReadsFileOf("postComment")), "utf8");
    assert.match(comment, /export const postCommentCachedReads = \{ list \};/);
    assert.match(comment, /import \{ postCommentBase \} from "\.\/postCommentBase";/);
    const tag = fs.readFileSync(path.join(root, "src/domains/core/tag", cachedReadsFileOf("tag")), "utf8");
    assert.match(tag, /pnpm generate cache が src\/domains\/core\/tag\/entities\/tag\/entity\.override\.ts の cache から/);
    assert.match(tag, /cacheLife\("minutes"\)/);
  });
});

test("消去: 宣言が消えた登録の印のある <登録名>CachedReads.ts だけを消す", () => {
  const generated = "// 生成物・編集不可: pnpm generate cache が x の cache から生成する\n";
  const files = {
    ...declared("src/domains/post", neon),
    [path.join("src/domains/post", cachedReadsFileOf("post"))]: generated,
    [path.join("src/domains/core/user", cachedReadsFileOf("user"))]: "// 手書き\n",
  };
  withTree(files, [postRow, userRow], (root, rows) => {
    const plan = planCachedReads(root, rows);
    assert.deepEqual(plan.removes, [path.join("src/domains/post", cachedReadsFileOf("post"))]);
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
    // 主でない登録の土台が無い: その登録の <登録名>Base.ts を名指す(ドメインの土台を読まない)
    "src/domains/post/entities/postComment/entity.json": { ...neon, singular: "post_comment", cache: { mode: "tagged", life: "days" } },
  };
  withTree(noOption, [postRow], (root, rows) => {
    const plan = planCachedReads(root, rows);
    const text = plan.problems.join("\n");
    assert.match(text, /\[post\] .*cacheTags: \{ domain: "post" \} を書いてください/);
    assert.match(text, /\[postComment\] src\/domains\/post\/services\/server\/postCommentBase\.ts がありません/);
    assert.deepEqual(plan.writes, []);
  });
  const abolished = { ...declared("src/domains/post", neon), "src/domains/post/cache.json": { mode: "tagged", life: "days" } };
  withTree(abolished, [postRow], (root, rows) => {
    assert.match(planCachedReads(root, rows).problems.join("\n"), /\[post\] src\/domains\/post\/cache\.json は廃止\(D353\)/);
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
