// src/features/core/*/entities/drizzle.ts が全て src/registry/schemaRegistry.ts から
// 到達可能であることを検証する。
//
// 背景: schemaRegistry は drizzle-kit push の唯一のスキーマ入口。core ドメインの
// drizzle.ts を作っても schemaRegistry に export し忘れると、db:push はそのテーブルを
// 作らず、bestEffort 書き込み (recordLoginEvent 等) は黙って失敗し続ける
// (実例: userLoginEvent, upstream-request 20260912-102632)。
//
// 実行: pnpm test:schema-registry  (node:test のみ。追加依存なし)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const CORE_DIR = join(ROOT, "src/features/core");
const REGISTRY_PATH = join(ROOT, "src/registry/schemaRegistry.ts");

/**
 * schemaRegistry.ts 内で `@/features/<domain>/entities/drizzle` または
 * `@/features/core/<domain>/entities/drizzle` を参照しているか (export * / 名前付き export 両対応)。
 */
const isReferenced = (registrySource, domain) => {
  const specifiers = [
    `"@/features/${domain}/entities/drizzle"`,
    `"@/features/core/${domain}/entities/drizzle"`,
  ];
  return specifiers.some((spec) => registrySource.includes(spec));
};

test("core ドメインの entities/drizzle.ts は全て schemaRegistry に登録されている", () => {
  const registrySource = readFileSync(REGISTRY_PATH, "utf8");
  const domains = readdirSync(CORE_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => existsSync(join(CORE_DIR, name, "entities/drizzle.ts")))
    .sort();

  assert.ok(domains.length > 0, "core ドメインの drizzle.ts が1件も見つからない (パス設定を確認)");

  const missing = domains.filter((domain) => !isReferenced(registrySource, domain));

  assert.deepEqual(
    missing,
    [],
    [
      "schemaRegistry.ts に未登録の core ドメインがある。db:push でテーブルが作られない:",
      ...missing.map((d) => `  export * from "@/features/${d}/entities/drizzle";`),
    ].join("\n"),
  );
});
