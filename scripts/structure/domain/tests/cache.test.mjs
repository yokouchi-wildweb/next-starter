// scripts/structure/domain/tests/cache.test.mjs
// ドメインの宣言 cache の検査(checks/cache.mjs・checks/cacheDeclarations.mjs)と正規化(spec/cache.mjs)の契約テスト。
// 実行: pnpm test scripts/structure/domain/tests/cache.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { cacheIssues } from "../checks/cache.mjs";
import { cacheDeclarationIssues } from "../checks/cacheDeclarations.mjs";
import { readCacheDeclarations } from "../domain/workspace.mjs";
import { normalizeCacheDeclaration } from "../spec/cache.mjs";

const config = {
  singular: "post",
  dbEngine: "Neon",
  useCreatedAt: true,
  useUpdatedAt: true,
  fields: [{ name: "title" }, { name: "is_published" }],
  relations: [{ domain: "user", fieldName: "author_id", relationType: "belongsTo" }],
};
const domains = new Set(["post", "user", "tag"]);
const check = (cache, extra = {}) => cacheIssues(cache, { domain: "post", domains, config, ...extra });

const good = {
  mode: "tagged",
  life: "days",
  list: { limit: 100 },
  reads: [
    {
      name: "published",
      where: { and: [{ field: "isPublished", op: "eq", value: true }, { field: "authorId", op: "isNotNull" }] },
      orderBy: [["createdAt", "DESC"]],
      limit: 20,
    },
  ],
  readsDomains: ["user"],
};

test("正しい宣言は問題 0(preset・秒の寿命・ttl の短い寿命)", () => {
  assert.deepEqual(check(good), []);
  assert.deepEqual(check({ mode: "tagged", life: { stale: 60, revalidate: 300, expire: 86400 } }), []);
  assert.deepEqual(check({ mode: "ttl", life: "minutes", get: false }), []);
  assert.match(check({ mode: "ttl", life: "seconds" }).join("\n"), /"seconds" は書けません/);
});

test("寿命: 書かない・default・知らない preset・expire なし・順の逆・上限超えは止める", () => {
  assert.match(check({ mode: "tagged" }).join("\n"), /life を書いて/);
  assert.match(check({ mode: "tagged", life: "default" }).join("\n"), /"default" は書けません/);
  assert.match(check({ mode: "tagged", life: "forever" }).join("\n"), /preset にありません/);
  assert.match(check({ mode: "tagged", life: { revalidate: 60 } }).join("\n"), /expire を書いて/);
  assert.match(check({ mode: "tagged", life: { stale: 600, expire: 60 } }).join("\n"), /stale ≤ revalidate ≤ expire/);
  assert.match(check({ mode: "tagged", life: "max" }).join("\n"), /tagged の上限 2592000 秒/);
  assert.deepEqual(check({ mode: "tagged", life: "weeks" }), []);
  assert.match(check({ mode: "ttl", life: "hours" }).join("\n"), /ttl の上限 3600 秒/);
  assert.match(check({ mode: "ttl", life: "days", reads: [{ name: "a", limit: 1, life: "minutes" }] }).join("\n"), /cache\.life の寿命/);
  assert.deepEqual(check({ mode: "tagged", life: "days", reads: [{ name: "a", limit: 1, mode: "ttl", life: "minutes" }] }), []);
  assert.match(check({ mode: "tagged", life: "days", reads: [{ name: "a", limit: 1, mode: "ttl" }] }).join("\n"), /cache\.reads\[0\]\.life の寿命 604800 秒は ttl の上限/);
});

test("キー・mode・get・list・limit の誤りは止める", () => {
  const issues = check({ mode: "fresh", life: "days", get: "yes", list: { limit: 0, size: 1 }, ttl: 5 }).join("\n");
  assert.match(issues, /知らないキー ttl/);
  assert.match(issues, /cache\.mode は tagged \/ ttl/);
  assert.match(issues, /cache\.get は true か false/);
  assert.match(issues, /cache\.list: 知らないキー size/);
  assert.match(issues, /cache\.list\.limit は 1〜1000/);
  assert.match(check({ mode: "tagged", life: "days", list: { limit: 1001 } }).join("\n"), /1〜1000/);
});

test("名前付きの読み: 名前・予約語・重複・引数のキー・where・orderBy・列", () => {
  const issues = check({
    mode: "tagged",
    life: "days",
    reads: [
      { name: "Bad-name", limit: 1 },
      { name: "get", limit: 1 },
      { name: "a", limit: 1 },
      { name: "a", limit: 1, args: ["slug"] },
      { name: "b", limit: 1, where: { field: "missing", op: "eq", value: 1 } },
      { name: "c", limit: 1, where: { field: "title", op: "regex", value: "x" } },
      { name: "d", limit: 1, where: { field: "title", op: "eq" } },
      { name: "e", limit: 1, where: { and: [] } },
      { name: "f", limit: 1, orderBy: [["title", "UP"]] },
      { name: "g", limit: 1, orderBy: [["nope", "ASC", "MIDDLE"]] },
      { name: "h" },
    ],
  }).join("\n");
  assert.match(issues, /reads\[0\]\.name は小文字で始まる/);
  assert.match(issues, /reads\[1\]\.name の get は使えません/);
  assert.match(issues, /reads\[3\]\.name の a が重なって/);
  assert.match(issues, /reads\[3\]: 知らないキー args/);
  assert.match(issues, /reads\[4\]\.where\.field の "missing" が列にありません/);
  assert.match(issues, /reads\[5\]\.where\.op の "regex"/);
  assert.match(issues, /reads\[6\]\.where\.value を書いて/);
  assert.match(issues, /reads\[7\]\.where\.and は条件の空でない配列/);
  assert.match(issues, /reads\[8\]\.orderBy\[0\] の向き/);
  assert.match(issues, /reads\[9\]\.orderBy\[0\] の "nope" が列にありません/);
  assert.match(issues, /reads\[9\]\.orderBy\[0\] の 3 つ目/);
  assert.match(issues, /reads\[10\]\.limit は 1〜1000/);
});

test("列を知らない宣言(cache.json のドメイン)は where・orderBy の形だけを見る", () => {
  const cache = { mode: "tagged", life: "days", reads: [{ name: "a", limit: 5, where: { field: "anything", op: "eq", value: 1 }, orderBy: [["whatever", "ASC"]] }] };
  assert.deepEqual(cacheIssues(cache, { domain: "post", domains }), []);
});

test("readsDomains: 自分・重複・地図に無い名前、dbEngine は Neon だけ", () => {
  const issues = check({ mode: "tagged", life: "days", readsDomains: ["post", "user", "user", "ghost"] }).join("\n");
  assert.match(issues, /自分\(post\)は書けません/);
  assert.match(issues, /readsDomains の user が重なって/);
  assert.match(issues, /ghost は地区の地図のドメインにありません/);
  assert.match(check({ mode: "tagged", life: "days" }, { config: { ...config, dbEngine: "Firestore" } }).join("\n"), /Neon のドメインだけ/);
});

test("正規化: get の既定 true、list・reads・readsDomains の既定、reads は頭の mode・life を継ぐ", () => {
  assert.deepEqual(normalizeCacheDeclaration({ mode: "ttl", life: "minutes" }), { mode: "ttl", life: "minutes", get: true, list: null, reads: [], readsDomains: [] });
  const normalized = normalizeCacheDeclaration(good);
  assert.equal(normalized.get, true);
  assert.deepEqual(normalized.list, { limit: 100 });
  assert.deepEqual(normalized.reads[0], { name: "published", where: good.reads[0].where, orderBy: [["createdAt", "DESC"]], limit: 20, mode: "tagged", life: "days" });
  assert.deepEqual(normalizeCacheDeclaration({ mode: "tagged", life: "days", get: false, reads: [{ name: "a", limit: 3, mode: "ttl", life: "seconds" }] }).reads[0], { name: "a", where: null, orderBy: null, limit: 3, mode: "ttl", life: "seconds" });
});

test("全ドメインの検査: domain.json の cache・cache.json・両方・domain.json があるのに cache.json・読めない JSON・宣言なし", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cache-decl-"));
  try {
    const write = (rel, value) => {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), typeof value === "string" ? value : JSON.stringify(value));
    };
    write("src/domains/post/domain.json", { ...config, generate: false, cache: { mode: "tagged", life: "days", readsDomains: ["user"] } });
    write("src/domains/core/user/cache.json", { mode: "ttl", life: "minutes" });
    write("src/domains/both/domain.json", { ...config, cache: { mode: "tagged", life: "days" } });
    write("src/domains/both/cache.json", { mode: "tagged", life: "days" });
    write("src/domains/misplaced/domain.json", config);
    write("src/domains/misplaced/cache.json", { mode: "tagged", life: "days" });
    write("src/domains/broken/cache.json", "{ nope");
    write("src/domains/bad/cache.json", { mode: "tagged", life: "default" });
    write("src/domains/plain/domain.json", config);
    const rows = [
      { kind: "domains", name: "post", dir: "src/domains/post", domainJson: true },
      { kind: "domains", name: "user", dir: "src/domains/core/user", domainJson: false },
      { kind: "domains", name: "both", dir: "src/domains/both", domainJson: true },
      { kind: "domains", name: "misplaced", dir: "src/domains/misplaced", domainJson: true },
      { kind: "domains", name: "broken", dir: "src/domains/broken", domainJson: false },
      { kind: "domains", name: "bad", dir: "src/domains/bad", domainJson: false },
      { kind: "domains", name: "plain", dir: "src/domains/plain", domainJson: true },
    ];
    const { issues, declared } = cacheDeclarationIssues(readCacheDeclarations(root, rows));
    assert.deepEqual(declared, ["post", "user", "bad"]);
    const text = issues.join("\n");
    assert.match(text, /\[both\] .*どちらか 1 つ/);
    assert.match(text, /\[misplaced\] domain\.json のあるドメインは cache\.json でなく/);
    assert.match(text, /\[broken\] cache\.json が JSON として読めません/);
    assert.match(text, /\[bad\] cache\.life に "default" は書けません/);
    assert.equal(issues.length, 4);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("readsDomains: 100 個を超えると止める(1 項目のキャッシュタグは 128 まで)", () => {
  const many = Array.from({ length: 101 }, (_, i) => `d${i}`);
  assert.match(cacheIssues({ mode: "tagged", life: "days", readsDomains: many }, { domain: "post", config }).join("\n"), /100 個まで/);
  assert.doesNotMatch(cacheIssues({ mode: "tagged", life: "days", readsDomains: many.slice(0, 100) }, { domain: "post", config }).join("\n"), /100 個まで/);
});
