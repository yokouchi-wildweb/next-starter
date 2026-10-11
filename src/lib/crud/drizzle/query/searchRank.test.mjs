// searchRank（関連度ランキング）の契約テスト。
// 実行: pnpm test:crud-search-rank （node:test + Node 組み込みの TypeScript type stripping。追加依存なし）
import { test } from "node:test";
import assert from "node:assert/strict";
import { pgTable, text, PgDialect } from "drizzle-orm/pg-core";

import { normalizeSearchRankSpec } from "./searchRankSpec.ts";
import {
  buildSearchRankOrderBy,
  buildSearchWhere,
  buildSearchPriorityOrderBy,
  buildWordStartRegex,
  escapeRegex,
} from "./buildSearchRank.ts";
import { parseSearchRank, BadRequestError } from "../../../../app/api/[domain]/search/utils.ts";

const dialect = new PgDialect();
const toSql = (chunk) => dialect.sqlToQuery(chunk);

const UsersTable = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email"),
  phoneNumber: text("phone_number"),
});

// ---- normalizeSearchRankSpec ----

test("searchRank 未指定 / false は空配列（従来経路にフォールバック）", () => {
  assert.deepEqual(normalizeSearchRankSpec(undefined, ["name", "email"]), []);
  assert.deepEqual(normalizeSearchRankSpec(false, ["name", "email"]), []);
});

test("searchRank: true + 既定無し → searchFields を等重み", () => {
  assert.deepEqual(normalizeSearchRankSpec(true, ["name", "email"]), [
    { field: "name", weight: 1 },
    { field: "email", weight: 1 },
  ]);
});

test("searchRank: true + サービス既定あり → 既定の重みを使い、searchFields 外は除外", () => {
  const serviceDefault = { fields: [{ field: "name", weight: 3 }, "email", "phoneNumber"] };
  assert.deepEqual(normalizeSearchRankSpec(true, ["name", "email"], serviceDefault), [
    { field: "name", weight: 3 },
    { field: "email", weight: 1 },
  ]);
});

test("呼び出し側 spec はサービス既定より優先、重複は先勝ち、不正 weight は除外", () => {
  const serviceDefault = { fields: [{ field: "name", weight: 3 }] };
  const spec = {
    fields: [
      { field: "email", weight: 5 },
      "email",
      { field: "name", weight: 0 },
      { field: "phoneNumber", weight: Number.NaN },
      { field: "  ", weight: 1 },
    ],
  };
  assert.deepEqual(normalizeSearchRankSpec(spec, ["name", "email", "phoneNumber"], serviceDefault), [
    { field: "email", weight: 5 },
  ]);
});

test("searchFields が空なら常に空配列（WHERE に参加しない列で並び替えない）", () => {
  assert.deepEqual(normalizeSearchRankSpec(true, []), []);
  assert.deepEqual(normalizeSearchRankSpec({ fields: ["name"] }, undefined), []);
});

// ---- 語頭一致の正規表現 ----

test("escapeRegex はメタ文字を全てエスケープする", () => {
  assert.equal(escapeRegex("a.b*c+d?e^f$g(h)i|j[k]l{m}n\\o/p-q"), "a\\.b\\*c\\+d\\?e\\^f\\$g\\(h\\)i\\|j\\[k\\]l\\{m\\}n\\\\o\\/p\\-q");
});

test("buildWordStartRegex は先頭または区切り文字直後を語頭とみなす", () => {
  const re = new RegExp(buildWordStartRegex("ab"), "i");
  assert.ok(re.test("abc"));
  assert.ok(re.test("john abe"));
  assert.ok(re.test("foo@abc.com"));
  assert.ok(re.test("foo.ab"));
  assert.ok(re.test("foo_ab"));
  assert.ok(re.test("foo-ab"));
  assert.ok(!re.test("cab"));
  assert.ok(!re.test("xabx"));
});

// ---- SQL 生成 ----

test("buildSearchWhere は searchFields の ILIKE %q% を OR で結合し、未知カラムは無視する", () => {
  const where = buildSearchWhere(UsersTable, "ab", ["name", "email", "unknown"]);
  const { sql, params } = toSql(where);
  assert.match(sql, /"users"\."name" ilike \$1 or "users"\."email" ilike \$2/);
  assert.deepEqual(params, ["%ab%", "%ab%"]);
  // 解決できるカラムが無い場合は FALSE（検索要求を無視して全件返さない）
  assert.equal(toSql(buildSearchWhere(UsersTable, "ab", ["unknown"])).sql, "FALSE");
});

test("buildSearchRankOrderBy は階層 CASE × weight を合算し DESC で返す", () => {
  const order = buildSearchRankOrderBy(UsersTable, "ab", [
    { field: "name", weight: 3 },
    { field: "email", weight: 1 },
  ]);
  const { sql, params } = toSql(order);
  // 階層スコアと重みはリテラル、クエリ由来の値は全てバインドパラメータ
  assert.match(sql, /THEN 100/);
  assert.match(sql, /THEN 60/);
  assert.match(sql, /THEN 40/);
  assert.match(sql, /THEN 20/);
  assert.match(sql, /ELSE 0 END \* 3\)/);
  assert.match(sql, /ELSE 0 END \* 1\)/);
  assert.match(sql, /\) \+ \(/);
  assert.match(sql, /\) DESC$/);
  assert.ok(!sql.includes("ab"), "クエリ文字列が SQL に直接埋め込まれていない");
  // name: exact, prefix, wordStart, substring / email: 同じ 4 つ
  assert.deepEqual(params, [
    "ab", "ab%", "(^|[\\s@._/-])ab", "%ab%",
    "ab", "ab%", "(^|[\\s@._/-])ab", "%ab%",
  ]);
});

test("buildSearchRankOrderBy は解決できるカラムが無ければ undefined", () => {
  assert.equal(buildSearchRankOrderBy(UsersTable, "ab", [{ field: "unknown", weight: 1 }]), undefined);
});

test("buildSearchPriorityOrderBy（旧経路）は挙動不変: searchFields との交差・重複除去・CASE 0/1", () => {
  const clauses = buildSearchPriorityOrderBy(UsersTable, "ab", ["name", "email"], ["email", "email", "phoneNumber"]);
  assert.equal(clauses.length, 1);
  const { sql, params } = toSql(clauses[0]);
  assert.match(sql, /CASE WHEN "users"\."email"::text ILIKE \$1 THEN 0 ELSE 1 END/);
  assert.deepEqual(params, ["%ab%"]);
});

// ---- HTTP パーサ（fail-closed） ----

test("parseSearchRank: boolean 表記", () => {
  assert.equal(parseSearchRank(null), undefined);
  assert.equal(parseSearchRank(""), undefined);
  assert.equal(parseSearchRank("true"), true);
  assert.equal(parseSearchRank("1"), true);
  assert.equal(parseSearchRank("false"), false);
  assert.equal(parseSearchRank("0"), false);
});

test("parseSearchRank: JSON spec を受理し正規化する", () => {
  assert.deepEqual(parseSearchRank('{"fields":["name",{"field":"email","weight":2},{"field":" phoneNumber "}]}'), {
    fields: ["name", { field: "email", weight: 2 }, { field: "phoneNumber" }],
  });
  assert.equal(parseSearchRank("{}"), true);
});

test("parseSearchRank: 不正入力は 400 相当の BadRequestError", () => {
  const bad = [
    "yes",
    "[1]",
    '{"fields":"name"}',
    '{"fields":[""]}',
    '{"fields":[{"field":"name","weight":0}]}',
    '{"fields":[{"field":"name","weight":101}]}',
    '{"fields":[{"field":"name","weight":"3"}]}',
    '{"fields":[{"field":"name","sql":"1"}]}',
    '{"fields":["name"],"tieBreak":[]}',
    '{"fields":[1]}',
    `{"fields":${JSON.stringify(Array.from({ length: 21 }, (_, i) => `f${i}`))}}`,
  ];
  for (const input of bad) {
    assert.throws(() => parseSearchRank(input), BadRequestError, `should reject: ${input}`);
  }
});
