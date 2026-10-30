// scripts/registry/alpha/alpha.test.mjs
// α 3 本の走査生成(./index.mjs)の回帰テスト。
// - 実リポ: 生成結果と一致(pnpm registry:check と同じ)
// - fixture: pgTable を持つファイル全部・profile の生成物は一覧を通す・キーは snake_case・メニューは印だけ・
//   読めない pgTable と JSON・フォルダ名の重なりは problems
// - dc:generate の登録済み判定が当たる字面と、行を足す置き先が残っている
// 実行: pnpm test:schema-registry

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";

import { ADMIN_DATA_MENU_FILE, DOMAIN_CONFIG_REGISTRY_FILE, SCHEMA_REGISTRY_FILE, buildAlphaRegistries, staleAlphaRegistries } from "./index.mjs";

const ROOT = resolve(import.meta.dirname, "../../..");

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "alpha-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

test("実リポ: 3 本が走査の生成結果と一致する(ずれたら pnpm registry:generate)", () => {
  const { outputs, problems } = buildAlphaRegistries(ROOT);
  assert.deepEqual(problems, []);
  assert.deepEqual(staleAlphaRegistries(ROOT, outputs), []);
});

test("生成: 表の入口・ドメイン設定・メニュー", () => {
  const root = fixture({
    "src/features/core/wallet/entities/drizzle.ts": 'export const A = pgTable("wallets", {});\n',
    "src/features/core/wallet/entities/lots.ts": 'export const B = pgTable("wallet_lots", {});\n',
    "src/features/core/wallet/types.ts": "export type X = 1;\n",
    "src/features/core/userProfile/generated/user/drizzle.ts": 'export const C = pgTable("user_profiles", {});\n',
    "src/features/sample/entities/drizzle.ts": 'export const D = pgTable("samples", {});\n',
    "src/features/core/chatRoom/domain.json": '{ "label": "チャット", "plural": "chat_rooms", "addToAdminDataMenu": false }',
    "src/features/sample/domain.json": '{ "label": "サンプル", "plural": "samples", "addToAdminDataMenu": true }',
    "src/features/sampleCategory/domain.json": '{ "label": "カテゴリ", "plural": "sample_categories", "addToAdminDataMenu": true }',
    "src/features/sampleImage/domain.json": '{ "label": "画像", "plural": "sample_images" }',
  });
  const { outputs, problems } = buildAlphaRegistries(root);
  assert.deepEqual(problems, []);
  const schema = outputs[SCHEMA_REGISTRY_FILE];
  assert.ok(schema.startsWith("// 生成物・編集不可: pnpm registry:generate が "));
  assert.deepEqual(
    schema.split("\n").filter((l) => l.startsWith("export *")),
    [
      'export * from "@/registry/profileTableRegistry";',
      'export * from "@/features/core/wallet/entities/drizzle";',
      'export * from "@/features/core/wallet/entities/lots";',
      'export * from "@/features/sample/entities/drizzle";',
    ],
  );
  assert.match(schema, /\nexport \{\};\n$/, "dc:generate の行の置き先");
  const config = outputs[DOMAIN_CONFIG_REGISTRY_FILE];
  assert.match(config, /import chatRoomConfig from "@\/features\/core\/chatRoom\/domain\.json";/);
  assert.match(config, /import sampleConfig from "@\/features\/sample\/domain\.json";/);
  assert.match(config, /\n  chat_room: chatRoomConfig,\n  sample: sampleConfig,\n  sample_category: sampleCategoryConfig,\n  sample_image: sampleImageConfig,\n\} as const;/);
  const menu = outputs[ADMIN_DATA_MENU_FILE];
  assert.match(menu, /= \[\n  \{ title: "サンプル", href: "\/admin\/samples" \},\n  \{ title: "カテゴリ", href: "\/admin\/sample-categories" \},\n\];\n$/);
});

test("problems: 字面で読めない pgTable・読めない domain.json・フォルダ名の重なり", () => {
  const { problems } = buildAlphaRegistries(
    fixture({
      "src/features/a/entities/drizzle.ts": "export const A = pgTable(NAME, {});\n",
      "src/features/b/domain.json": "{ nope",
      "src/features/foo/domain.json": "{}",
      "src/features/core/foo/domain.json": "{}",
    }),
  );
  assert.equal(problems.length, 3, problems.join("\n"));
  assert.ok(problems.some((p) => p.includes("b/domain.json") && p.includes("JSON")));
  assert.ok(problems.some((p) => p.includes("foo/domain.json") && p.includes("重なる")));
  assert.ok(problems.some((p) => p.includes("a/entities/drizzle.ts") && p.includes("文字列リテラルでない")));
});
