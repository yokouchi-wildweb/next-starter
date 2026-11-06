// scripts/operations/db/clear/plan.test.ts(pnpm test scripts/operations/db/clear/plan.test.ts)
// db:clear の計画(参照元の推移・自己参照・閉じた参照元・DB に無い表・--include-closed)と TRUNCATE の文を確かめる。

import assert from "node:assert/strict";
import { test } from "node:test";

import { pgTable, text, type AnyPgColumn } from "drizzle-orm/pg-core";

import { buildTruncateSql, planClear, readTableGraph, selectableTables } from "./plan";

// fixture: users ← posts ← comments(推移)、categories(自己参照)→ users、
// wallets(閉じた機能)→ users、wallet_logs(閉じた機能)→ wallets、drafts(DB に無い)→ users、draft_notes → drafts
const users = pgTable("users", { id: text("id").primaryKey() });
const posts = pgTable("posts", { id: text("id").primaryKey(), userId: text("user_id").references(() => users.id) });
const comments = pgTable("comments", { id: text("id").primaryKey(), postId: text("post_id").references(() => posts.id) });
const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  parentId: text("parent_id").references((): AnyPgColumn => categories.id),
  ownerId: text("owner_id").references(() => users.id),
});
const wallets = pgTable("wallets", { id: text("id").primaryKey(), userId: text("user_id").references(() => users.id) });
const walletLogs = pgTable("wallet_logs", { id: text("id").primaryKey(), walletId: text("wallet_id").references(() => wallets.id) });
const drafts = pgTable("drafts", { id: text("id").primaryKey(), userId: text("user_id").references(() => users.id) });
const draftNotes = pgTable("draft_notes", { id: text("id").primaryKey(), draftId: text("draft_id").references(() => drafts.id) });
const tags = pgTable("tags", { id: text("id").primaryKey() });

const schema = {
  UserTable: users,
  PostTable: posts,
  CommentTable: comments,
  CategoryTable: categories,
  WalletTable: wallets,
  WalletLogTable: walletLogs,
  DraftTable: drafts,
  DraftNoteTable: draftNotes,
  TagTable: tags,
  UserTableAlias: users,
  notATable: { foo: 1 },
};

const graph = readTableGraph(schema);
const closed = ["wallets", "wallet_logs"];
const allInDb = ["users", "posts", "comments", "categories", "wallets", "wallet_logs", "tags"];

test("readTableGraph: pgTable だけ・重複なし・自己参照は除く", () => {
  assert.deepEqual(graph.names, ["users", "posts", "comments", "categories", "wallets", "wallet_logs", "drafts", "draft_notes", "tags"]);
  assert.deepEqual(graph.references.get("categories"), ["users"]);
  assert.deepEqual(graph.references.get("comments"), ["posts"]);
  assert.deepEqual(graph.references.get("tags"), []);
});

test("selectableTables: 閉じた表は外して名前を出す・--include-closed なら全部", () => {
  assert.deepEqual(selectableTables(graph, closed, false), {
    selectable: ["users", "posts", "comments", "categories", "drafts", "draft_notes", "tags"],
    excludedClosed: ["wallets", "wallet_logs"],
  });
  assert.deepEqual(selectableTables(graph, closed, true), { selectable: graph.names, excludedClosed: [] });
});

test("planClear: 推移的な参照元を足す・自己参照で止まらない・DB に無い表は外す", () => {
  const plan = planClear({ graph, closedTables: closed, dbTables: ["users", "posts", "comments", "categories", "tags"], selected: ["users"], includeClosed: false });
  assert.deepEqual(plan.tables, ["users", "posts", "comments", "categories"]);
  assert.deepEqual(plan.selected, ["users"]);
  assert.deepEqual(plan.addedReferrers, ["posts", "comments", "categories"]);
  assert.deepEqual(plan.missingInDb, ["drafts"]);
  assert.deepEqual(plan.blockers, []);
  assert.deepEqual(plan.skippedClosed, []);
});

test("planClear: DB にある閉じた表が参照していれば止める理由を全部並べる", () => {
  const plan = planClear({ graph, closedTables: closed, dbTables: allInDb, selected: ["users"], includeClosed: false });
  assert.deepEqual(plan.blockers, [{ from: "wallets", to: "users" }]);
  assert.ok(!plan.tables.includes("wallets"));
});

test("planClear: 閉じた参照元が DB に無ければ止めない", () => {
  const plan = planClear({ graph, closedTables: closed, dbTables: ["users", "posts", "comments", "categories"], selected: ["users"], includeClosed: false });
  assert.deepEqual(plan.blockers, []);
  assert.deepEqual(plan.missingInDb, ["drafts"]);
});

test("planClear: --include-closed なら閉じた表も参照元に足す(その先も推移)", () => {
  const plan = planClear({ graph, closedTables: closed, dbTables: allInDb, selected: ["users"], includeClosed: true });
  assert.deepEqual(plan.tables, ["users", "posts", "comments", "categories", "wallets", "wallet_logs"]);
  assert.deepEqual(plan.blockers, []);
});

test("planClear: 閉じた表を選んでも --include-closed でなければ外す", () => {
  const plan = planClear({ graph, closedTables: closed, dbTables: allInDb, selected: ["wallets", "tags"], includeClosed: false });
  assert.deepEqual(plan.tables, ["tags"]);
  assert.deepEqual(plan.skippedClosed, ["wallets"]);
});

test("planClear: 選んだ表が DB に無ければ外す・schemaRegistry に無い表は例外", () => {
  const plan = planClear({ graph, closedTables: closed, dbTables: allInDb, selected: ["drafts", "tags"], includeClosed: false });
  assert.deepEqual(plan.tables, ["tags"]);
  assert.deepEqual(plan.missingInDb, ["drafts"]);
  assert.throws(() => planClear({ graph, closedTables: closed, dbTables: allInDb, selected: ["nope"], includeClosed: false }), /nope/);
});

test("buildTruncateSql: 1 文・RESTRICT・連鎖の削除なし・識別子を引用", () => {
  assert.equal(buildTruncateSql(["users", "posts"]), 'TRUNCATE TABLE "users", "posts" RESTRICT');
  assert.doesNotMatch(buildTruncateSql(["users"]), /cascade/i);
  assert.equal(buildTruncateSql(['a"b']), 'TRUNCATE TABLE "a""b" RESTRICT');
  assert.throws(() => buildTruncateSql([]));
});
