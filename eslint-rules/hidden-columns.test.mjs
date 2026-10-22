// eslint-rules/hidden-columns.test.mjs
// 秘匿カラムの生 select / returning 検出規則の契約テスト。実行: pnpm test:hidden-columns-lint (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { RuleTester } from "eslint";

import plugin, { collectHiddenColumns, parseHiddenColumnDeclarations } from "./hidden-columns.mjs";

test("parseHiddenColumnDeclarations: defineHiddenColumns の宣言を読み取る", () => {
  const source = `
    export const UserTable = pgTable("users", {});
    defineHiddenColumns(UserTable, ["localPassword"]);
    defineHiddenColumns(DevicePairingTable, [
      "codeHash",
      'pendingTokenHash',
    ]);
  `;
  assert.deepEqual(parseHiddenColumnDeclarations(source), {
    UserTable: ["localPassword"],
    DevicePairingTable: ["codeHash", "pendingTokenHash"],
  });
});

test("collectHiddenColumns: リポジトリの entities/drizzle.ts から宣言を集める（users.localPassword を含む）", () => {
  const collected = collectHiddenColumns(path.join(import.meta.dirname, "..", "src"));
  assert.ok(collected.UserTable?.includes("localPassword"));
});

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module" },
});

const options = [{ hiddenColumns: { UserTable: ["localPassword"], PairedDeviceTable: ["tokenHash"] } }];

ruleTester.run("hidden-columns/no-raw-select", plugin.rules["no-raw-select"], {
  valid: [
    // 秘匿カラムを含まない明示 select
    { code: "db.select({ id: UserTable.id, name: UserTable.name }).from(UserTable);", options },
    // getPublicColumns で丸ごと取得
    { code: "db.select(getPublicColumns(UserTable)).from(UserTable);", options },
    { code: "db.insert(UserTable).values(v).returning(getPublicColumns(UserTable));", options },
    // 条件側での参照は対象外
    { code: "db.select({ id: PairedDeviceTable.id }).from(PairedDeviceTable).where(eq(PairedDeviceTable.tokenHash, h));", options },
    // 秘匿カラムを持たないテーブルは丸ごと取得してよい
    { code: "db.select().from(OrderTable);", options },
    { code: "db.insert(OrderTable).values(v).returning();", options },
    { code: "db.update(PairedDeviceTable).set(v).returning({ id: PairedDeviceTable.id });", options },
    { code: "db.select({ ...getTableColumns(OrderTable) }).from(OrderTable);", options },
    // 宣言が無ければ何もしない
    { code: "db.select().from(UserTable);", options: [{ hiddenColumns: {} }] },
  ],
  invalid: [
    {
      // 一覧 loader の漏洩パターン（入れ子の select オブジェクトも辿る）
      code: "db.select({ id: UserTable.id, localPassword: UserTable.localPassword }).from(UserTable);",
      options,
      errors: [{ messageId: "explicitColumn" }],
    },
    {
      code: "db.select({ user: { id: UserTable.id, pw: UserTable.localPassword } }).from(UserTable);",
      options,
      errors: [{ messageId: "explicitColumn" }],
    },
    {
      code: "db.update(UserTable).set(v).returning({ pw: UserTable.localPassword });",
      options,
      errors: [{ messageId: "explicitColumn" }],
    },
    {
      code: "db.select({ ...getTableColumns(UserTable), coins: sql`1` }).from(UserTable);",
      options,
      errors: [{ messageId: "spreadColumns" }],
    },
    {
      code: "db.select(getTableColumns(UserTable)).from(UserTable);",
      options,
      errors: [{ messageId: "spreadColumns" }],
    },
    {
      code: "db.select().from(UserTable).where(eq(UserTable.id, id));",
      options,
      errors: [{ messageId: "fullRow" }],
    },
    {
      code: "db.selectDistinct().from(PairedDeviceTable);",
      options,
      errors: [{ messageId: "fullRow" }],
    },
    {
      code: "(tx ?? db).insert(UserTable).values(v).returning();",
      options,
      errors: [{ messageId: "fullRow" }],
    },
    {
      code: "db.update(PairedDeviceTable).set(v).where(eq(PairedDeviceTable.id, id)).returning();",
      options,
      errors: [{ messageId: "fullRow" }],
    },
    {
      code: "db.delete(UserTable).where(eq(UserTable.id, id)).returning();",
      options,
      errors: [{ messageId: "fullRow" }],
    },
  ],
});
