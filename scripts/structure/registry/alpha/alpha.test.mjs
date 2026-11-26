// scripts/structure/registry/alpha/alpha.test.mjs
// α 4 本の走査生成(./index.mjs)の回帰テスト。
// - 実リポ: 生成結果と一致(pnpm check registry と同じ)
// - fixture: pgTable を持つファイル全部・profile の生成物は一覧を通す・キーは snake_case・管理一覧は画面のあるドメインだけ・
//   読めない pgTable と JSON・フォルダ名の重なりは problems(宣言は domain.json + entities/<登録名>/entity.json)
// - pnpm generate domain の登録済み判定が当たる字面と、行を足す置き先が残っている
// 実行: pnpm test scripts/structure/registry/alpha/alpha.test.mjs

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";

import { ADMIN_DOMAINS_FILE, DOMAIN_CONFIG_REGISTRY_FILE, SCHEMA_REGISTRY_FILE, STORAGE_PURPOSE_REGISTRY_FILE, buildAlphaRegistries, staleAlphaRegistries } from "./index.mjs";

const ROOT = resolve(import.meta.dirname, "../../../..");

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "alpha-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

/**
 * fixture のドメインの宣言: domain.json(label)と主の登録の entities/<フォルダ名>/entity.json(本文 text のまま)。
 * folder = リポジトリ直下からのドメインのフォルダ
 */
function declared(folder, text) {
  let label;
  try {
    label = JSON.parse(text).label;
  } catch {
    label = undefined;
  }
  const name = folder.split("/").at(-1);
  return {
    [`${folder}/domain.json`]: JSON.stringify({ domainConfigVersion: "2.0", ...(label !== undefined ? { label } : {}) }),
    [`${folder}/entities/${name}/entity.json`]: text,
  };
}

test("実リポ: 4 本が走査の生成結果と一致する(ずれたら pnpm generate registry)", () => {
  const { outputs, problems } = buildAlphaRegistries(ROOT);
  assert.deepEqual(problems, []);
  assert.deepEqual(staleAlphaRegistries(ROOT, outputs), []);
});

test("生成: 表の入口・ドメイン設定", () => {
  const root = fixture({
    "src/domains/core/wallet/entities/drizzle.ts": 'export const A = pgTable("wallets", {});\n',
    "src/domains/core/wallet/entities/lots.ts": 'export const B = pgTable("wallet_lots", {});\n',
    "src/domains/core/wallet/types.ts": "export type X = 1;\n",
    "src/domains/core/userProfile/entities/profiles/user/drizzle.ts": 'export const C = pgTable("user_profiles", {});\n',
    "src/domains/sample/entities/drizzle.ts": 'export const D = pgTable("samples", {});\n',
    ...declared("src/domains/core/chatRoom", '{ "label": "チャット", "plural": "chat_rooms", "addToAdminDataMenu": false }'),
    ...declared("src/domains/sample", '{ "label": "サンプル", "plural": "samples", "addToAdminDataMenu": true }'),
    ...declared("src/domains/sampleCategory", '{ "label": "カテゴリ", "plural": "sample_categories", "addToAdminDataMenu": true }'),
    ...declared("src/domains/sampleImage", '{ "label": "画像", "plural": "sample_images" }'),
  });
  const { outputs, problems } = buildAlphaRegistries(root);
  assert.deepEqual(problems, []);
  const schema = outputs[SCHEMA_REGISTRY_FILE];
  assert.ok(schema.startsWith("// 生成物・編集不可: pnpm generate registry が "));
  assert.deepEqual(
    schema.split("\n").filter((l) => l.startsWith("export *")),
    [
      'export * from "@/domains/core/userProfile/entities/profiles/user/drizzle";',
      'export * from "@/domains/core/wallet/entities/drizzle";',
      'export * from "@/domains/core/wallet/entities/lots";',
      'export * from "@/domains/sample/entities/drizzle";',
    ],
  );
  assert.match(schema, /\nexport \{\};\n$/);
  const config = outputs[DOMAIN_CONFIG_REGISTRY_FILE];
  assert.match(config, /import chatRoomConfig from "@\/domains\/core\/chatRoom\/entities\/chatRoom\/entity\.json";/);
  assert.match(config, /import sampleConfig from "@\/domains\/sample\/entities\/sample\/entity\.json";/);
  assert.match(config, /\n  chat_room: chatRoomConfig,\n  sample: sampleConfig,\n  sample_category: sampleCategoryConfig,\n  sample_image: sampleImageConfig,\n\} as const;/);
});

test("生成: ファイル用途の一覧は services/server/storagePurposes.ts を path 順に並べる(core も同じ)", () => {
  const root = mkdtempSync(join(tmpdir(), "alpha-purposes-"));
  for (const dir of ["src/domains/album", "src/domains/core/coupon"]) {
    mkdirSync(join(root, dir, "services/server"), { recursive: true });
    writeFileSync(join(root, dir, "services/server/storagePurposes.ts"), "export const purposes = {};\n");
  }
  const text = buildAlphaRegistries(root).outputs[STORAGE_PURPOSE_REGISTRY_FILE];
  rmSync(root, { recursive: true, force: true });
  assert.match(text, /import \{ purposes as albumPurposes \} from "@\/domains\/album\/services\/server\/storagePurposes";/);
  assert.match(text, /import \{ purposes as couponPurposes \} from "@\/domains\/core\/coupon\/services\/server\/storagePurposes";/);
  assert.match(text, /storagePurposeRegistry: StoragePurposeMap\[\] = \[\n  albumPurposes,\n  couponPurposes,\n\];/);
});

test("problems: 字面で読めない pgTable・読めない entity.json・フォルダ名の重なり", () => {
  const { problems } = buildAlphaRegistries(
    fixture({
      "src/domains/a/entities/drizzle.ts": "export const A = pgTable(NAME, {});\n",
      ...declared("src/domains/b", "{ nope"),
      ...declared("src/domains/foo", "{}"),
      ...declared("src/domains/core/foo", "{}"),
    }),
  );
  assert.equal(problems.length, 3, problems.join("\n"));
  assert.ok(problems.some((p) => p.includes("b/entities/b/entity.json") && p.includes("JSON")));
  assert.ok(problems.some((p) => p.includes("foo/entities/foo/entity.json") && p.includes("重なる")));
  assert.ok(problems.some((p) => p.includes("a/entities/drizzle.ts") && p.includes("文字列リテラルでない")));
});

test("管理一覧の一覧: 一覧の画面があるドメインだけ(generate: false も)、キー = フォルダ名、印の無い addToAdminDataMenu は false", () => {
  const root = fixture({
    ...declared("src/domains/core/chatRoom", '{ "generate": false, "label": "チャット", "plural": "chat_rooms" }'),
    ...declared("src/domains/sample", '{ "label": "サンプル", "plural": "samples", "addToAdminDataMenu": true }'),
    ...declared("src/domains/sampleImage", '{ "label": "画像", "plural": "sample_images", "addToAdminDataMenu": true }'),
    ...declared("src/domains/core/coupon", '{ "generate": false, "label": "クーポン", "plural": "coupons" }'),
    "src/app/admin/(protected)/chat-rooms/page.tsx": "export {};\n",
    "src/app/admin/(protected)/samples/page.tsx": "export {};\n",
    "src/app/admin/(protected)/coupons/official/page.tsx": "export {};\n",
  });
  const { outputs, problems } = buildAlphaRegistries(root);
  assert.deepEqual(problems, []);
  const rows = outputs[ADMIN_DOMAINS_FILE].split("\n").filter((l) => l.startsWith("  "));
  assert.deepEqual(rows, [
    '  chatRoom: { label: "チャット", href: "/admin/chat-rooms", addToAdminDataMenu: false },',
    '  sample: { label: "サンプル", href: "/admin/samples", addToAdminDataMenu: true },',
  ]);
  assert.match(outputs[ADMIN_DOMAINS_FILE], /\nexport type AdminDomainName = keyof typeof adminDomains;\n$/);
});
