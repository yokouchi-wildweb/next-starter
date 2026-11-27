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

const domainJson = (/** @type {string} */ label) => JSON.stringify({ domainConfigVersion: "2.0", label });

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

test("entities/ の下のサブフォルダだけのフォルダ(役割の表 profiles/ など)は登録でなく、schema.ts だけのフォルダは登録(entity.json が無いのは problems)", () => {
  const source = memorySource({
    "src/domains/core/userProfile/domain.json": domainJson("プロフィール"),
    "src/domains/core/userProfile/entities/profiles/contributor/index.ts": "",
    "src/domains/core/userProfile/entities/legacy/schema.ts": "",
  });
  const userProfile = readDomain(source, "userProfile");
  assert.deepEqual(userProfile.registrations, [{ name: "legacy", dir: "src/domains/core/userProfile/entities/legacy", entity: null }]);
  assert.deepEqual(userProfile.problems, ["src/domains/core/userProfile/entities/legacy/entity.json が無い"]);
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

test("手で持つ表の形の鍵は entity.json に書ける", () => {
  const entity = {
    generate: false,
    table: "analytics_daily_rollups",
    primaryKey: { columns: ["metric_key", "bucket_date", "dims_key"], name: "analytics_daily_rollups_pk" },
    fields: [
      { name: "dims_key", fieldType: "string", column: { default: "", notNull: true } },
      { name: "value", fieldType: "number", column: { type: "numeric" } },
      { name: "computed_at", fieldType: "timestamp", column: { default: { sql: "now()" }, notNull: true } },
      { name: "status", fieldType: "enum", column: { enum: "purchase_request_status" } },
      { name: "seq", fieldType: "number", column: { type: "bigint", identity: "always" } },
    ],
    foreignKeys: [{ columns: ["owner_group_id"], references: { table: "user_groups", columns: ["id"] }, onDelete: "SET NULL", name: "user_groups_owner_fk" }],
    indexes: [
      { fields: ["created_at"], desc: ["created_at"] },
      { expressions: ["lower(btrim(name))"], name: "users_name_lower_idx" },
      { fields: ["provider_type", "provider_uid"], unique: true, where: "deleted_at IS NULL", name: "users_provider_uq" },
    ],
    checks: [{ name: "amount_positive", sql: "amount > 0" }],
    enums: [
      { name: "audit_actor_type", values: ["user", "system"] },
      { name: "purchase_request_status", valuesFrom: { file: "src/domains/core/purchaseRequest/constants/status.ts", export: "PURCHASE_REQUEST_STATUSES" } },
    ],
    dbObjects: [{ kind: "trigger", file: "entities/userMetrics/userMetrics.trigger.sql" }],
    service: { file: "analyticsService", export: "analyticsService" },
  };
  const source = memorySource({
    "src/domains/core/analytics/domain.json": domainJson("分析"),
    "src/domains/core/analytics/entities/analyticsDailyRollup/entity.json": JSON.stringify(entity),
  });
  const analytics = readDomain(source, "analytics");
  assert.deepEqual(analytics.registrations[0].entity, entity);
  assert.deepEqual(analytics.problems, []);
});

test("入れ子の知らない鍵・配列でない項目は problems。今の形の compositeUniques は entity.json に書けない", () => {
  const source = memorySource({
    "src/domains/core/user/domain.json": domainJson("ユーザー"),
    "src/domains/core/user/entities/user/entity.json": JSON.stringify({
      compositeUniques: [["provider_type", "provider_uid"]],
      fields: [{ name: "ip", column: { type: "inet", nullable: true } }],
      relations: [{ domain: "user_tag", cascade: true }],
      indexes: [{ fields: ["status"], order: "desc" }],
      foreignKeys: [{ columns: ["a"], references: { table: "t", column: "id" } }],
      enums: [{ name: "e", valuesFrom: { file: "f", name: "X" } }],
      checks: { name: "c", sql: "x" },
      service: { file: "userService", default: true },
    }),
  });
  const rel = "src/domains/core/user/entities/user/entity.json";
  assert.deepEqual(readDomain(source, "user").problems, [
    `${rel}: 知らない鍵 "compositeUniques"`,
    `${rel}: fields[0].column の知らない鍵 "nullable"`,
    `${rel}: relations[0] の知らない鍵 "cascade"`,
    `${rel}: indexes[0] の知らない鍵 "order"`,
    `${rel}: foreignKeys[0].references の知らない鍵 "column"`,
    `${rel}: checks が配列でない`,
    `${rel}: enums[0].valuesFrom の知らない鍵 "name"`,
    `${rel}: service の知らない鍵 "default"`,
  ]);
});
