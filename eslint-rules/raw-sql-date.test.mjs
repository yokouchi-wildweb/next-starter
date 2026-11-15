// eslint-rules/raw-sql-date.test.mjs
// 生の sql`` に Date を埋め込まない検査の契約テスト。実行: pnpm test eslint-rules/raw-sql-date.test.mjs (node:test)
import { test } from "node:test";
import { createRequire } from "node:module";
import { RuleTester } from "eslint";

import plugin from "./raw-sql-date.mjs";

const tsParser = createRequire(import.meta.resolve("eslint-config-next"))("@typescript-eslint/parser");

const ruleTester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: "latest", sourceType: "module" },
});

const errors = [{ messageId: "date" }];

test("raw-sql-date: sql`` の ${…} の Date を止め、文字列化・演算子・他の値は通す", () => {
  ruleTester.run("no-date-param", plugin.rules["no-date-param"], {
    valid: [
      { code: "const cutoff = new Date(); sql`created_at < ${cutoff.toISOString()}::timestamptz`;" },
      { code: "sql`created_at < ${new Date().toISOString()}::timestamptz`;" },
      { code: "sql`ts > ${Date.now()}`;" },
      { code: "function f(cutoff: Date) { return sql`created_at < ${cutoff.toISOString()}`; }" },
      { code: "function f(cutoff: Date) { return lt(table.createdAt, cutoff); }" },
      { code: "sql`${table.createdAt} < now()`;" },
      { code: "const id = 'x'; sql`id = ${id}`;" },
      { code: "function f(cutoff: string) { return sql`created_at < ${cutoff}`; }" },
      // let は後で入れ替わるので型注記が無ければ見ない
      { code: "let at = new Date(); at = later(); sql`created_at < ${at}`;" },
      // 外側の Date を内側の同名の文字列が隠す
      { code: "const at = new Date(); function f(at: string) { return sql`x < ${at}`; }" },
      // sql 以外のタグ・タグなしのテンプレート
      { code: "const d = new Date(); css`${d}`; `${d}`;" },
      { code: "sql.raw(`${new Date().toISOString()}`);" },
    ],
    invalid: [
      { code: "sql`created_at < ${new Date()}`;", errors },
      { code: "const cutoff = new Date(Date.now() - 1000); sql`created_at < ${cutoff}::timestamptz`;", errors },
      { code: "function f(cutoff: Date) { return sql`created_at < ${cutoff}`; }", errors },
      { code: "const f = (cutoff: Date | null) => sql`created_at < ${cutoff}`;", errors },
      { code: "function f(cutoff = new Date()) { return sql`created_at < ${cutoff}`; }", errors },
      { code: "let at: Date = later(); sql`created_at < ${at}`;", errors },
      { code: "const at = value as Date; sql`x < ${at}`;", errors },
      { code: "sql`x < ${value as Date}`;", errors },
      { code: "sql`x < ${flag ? new Date() : null}`;", errors },
      { code: "function f(at?: Date) { return sql`x < ${at ?? new Date()}`; }", errors },
      { code: "const a = new Date(); const b = a; sql`x < ${b!}`;", errors },
      { code: "sql`x between ${new Date()} and ${new Date()}`;", errors: [...errors, ...errors] },
    ],
  });
});
