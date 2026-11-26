// src/lib/domain/definition/readDomain.mjs の検査(記憶の中の小さな木)。実行: pnpm test src/lib/domain/definition/readDomain.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import { listDomains, readDomain, readDomains } from "./readDomain.mjs";

/**
 * ファイルの道 → 本文 の表から source を作る(フォルダは道から導く)
 * @param {Record<string, string>} files
 * @returns {import("./readDomain.mjs").DomainSource}
 */
function memorySource(files) {
  return {
    listDir(rel) {
      const prefix = `${rel}/`;
      /** @type {Map<string, boolean>} */
      const entries = new Map();
      for (const path of Object.keys(files)) {
        if (!path.startsWith(prefix)) continue;
        const rest = path.slice(prefix.length).split("/");
        entries.set(rest[0], rest.length > 1 || entries.get(rest[0]) === true);
      }
      return [...entries].map(([name, isDir]) => ({ name, isDir })).sort((a, b) => (a.name < b.name ? -1 : 1));
    },
    readText(rel) {
      return files[rel] ?? null;
    },
  };
}

const domainJson = (label) => JSON.stringify({ domainConfigVersion: "2.0", label });

test("表 0 のドメインは登録 0", () => {
  const source = memorySource({ "src/domains/core/legal/domain.json": domainJson("規約"), "src/domains/core/legal/config.ts": "" });
  const legal = readDomain(source, "legal");
  assert.deepEqual(legal, {
    name: "legal",
    core: true,
    dir: "src/domains/core/legal",
    domain: { domainConfigVersion: "2.0", label: "規約" },
    registrations: [],
    problems: [],
  });
});

test("表 1 のドメインは登録名 = ドメイン名の登録 1 件", () => {
  const source = memorySource({
    "src/domains/sample/domain.json": domainJson("サンプル"),
    "src/domains/sample/entities/sample/entity.json": JSON.stringify({ singular: "sample", plural: "samples", generate: true }),
    "src/domains/sample/entities/sample/schema.ts": "",
  });
  const sample = readDomain(source, "sample");
  assert.equal(sample.core, false);
  assert.deepEqual(sample.registrations, [
    { name: "sample", dir: "src/domains/sample/entities/sample", entity: { singular: "sample", plural: "samples", generate: true } },
  ]);
  assert.deepEqual(sample.problems, []);
});

test("表 2 以上のドメインは登録がフォルダの名前順に並ぶ(一覧はどこにも書かない)", () => {
  const source = memorySource({
    "src/domains/core/auditLog/domain.json": domainJson("監査ログ"),
    "src/domains/core/auditLog/entities/auditLogFailed/entity.json": JSON.stringify({ registered: false, reason: "失敗の退避先" }),
    "src/domains/core/auditLog/entities/auditLog/entity.json": JSON.stringify({ generate: false }),
    "src/domains/core/auditLog/entities/index.ts": "",
  });
  const auditLog = readDomain(source, "auditLog");
  assert.deepEqual(auditLog.registrations.map((registration) => registration.name), ["auditLog", "auditLogFailed"]);
  assert.deepEqual(auditLog.registrations[1].entity, { registered: false, reason: "失敗の退避先" });
  assert.deepEqual(auditLog.problems, []);
});

test("一覧は業務と core の両方を名前順に、_ で始まるフォルダは除く。domain.json の有無で選ばない", () => {
  const source = memorySource({
    "src/domains/_template/hooks/x.ts": "",
    "src/domains/sample/domain.json": domainJson("サンプル"),
    "src/domains/core/user/hooks/x.ts": "",
    "src/domains/core/auth/domain.json": domainJson("認証"),
  });
  assert.deepEqual(listDomains(source), {
    domains: [
      { name: "auth", core: true, dir: "src/domains/core/auth" },
      { name: "sample", core: false, dir: "src/domains/sample" },
      { name: "user", core: true, dir: "src/domains/core/user" },
    ],
    problems: [],
  });
  assert.deepEqual(
    readDomains(source).map((domain) => [domain.name, domain.problems]),
    [
      ["auth", []],
      ["sample", []],
      ["user", ["src/domains/core/user/domain.json が無い"]],
    ],
  );
});

test("無い・壊れた・知らない鍵は problems に入り、推測で埋めない", () => {
  const source = memorySource({
    "src/domains/core/user/domain.json": JSON.stringify({ domainConfigVersion: "2.0", label: "ユーザー", fields: [] }),
    "src/domains/core/user/entities/user/entity.json": "{ broken",
    "src/domains/core/user/entities/userStatusHistory/schema.ts": "",
    "src/domains/core/user/entities/userTag/entity.json": JSON.stringify({ plural: "user_tags", note: "x" }),
    "src/domains/core/user/entities/list/entity.json": "[]",
  });
  const user = readDomain(source, "user");
  assert.deepEqual(user.domain, { domainConfigVersion: "2.0", label: "ユーザー", fields: [] });
  assert.deepEqual(
    user.registrations.map((registration) => [registration.name, registration.entity]),
    [
      ["list", null],
      ["user", null],
      ["userStatusHistory", null],
      ["userTag", { plural: "user_tags", note: "x" }],
    ],
  );
  assert.equal(user.problems.length, 5);
  assert.equal(user.problems[0], 'src/domains/core/user/domain.json: 知らない鍵 "fields"');
  assert.equal(user.problems[1], "src/domains/core/user/entities/list/entity.json: 中身がオブジェクトでない");
  assert.match(user.problems[2], /^src\/domains\/core\/user\/entities\/user\/entity\.json: JSON として読めない/);
  assert.equal(user.problems[3], "src/domains/core/user/entities/userStatusHistory/entity.json が無い");
  assert.equal(user.problems[4], 'src/domains/core/user/entities/userTag/entity.json: 知らない鍵 "note"');
});

test("業務と core の両方にある名前・どこにも無い名前は problems", () => {
  const source = memorySource({
    "src/domains/coupon/domain.json": domainJson("クーポン"),
    "src/domains/core/coupon/domain.json": domainJson("クーポン"),
  });
  assert.deepEqual(listDomains(source).problems, [
    'ドメイン "coupon" が src/domains/coupon/ と src/domains/core/coupon/ の両方にある(1 つにする)',
  ]);
  assert.deepEqual(readDomain(source, "coupon").problems, listDomains(source).problems);
  assert.deepEqual(readDomain(source, "missing").problems, ['ドメイン "missing" のフォルダが src/domains/ にも src/domains/core/ にも無い']);
});
