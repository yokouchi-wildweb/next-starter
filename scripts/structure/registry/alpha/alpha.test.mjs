// scripts/structure/registry/alpha/alpha.test.mjs
// α 4 本と集める入口 entities/<種類>.ts の走査生成(./index.mjs)の回帰テスト。
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
  // 主の登録が書いていない名前と項目の鍵だけを既定で埋める(singular = 登録名の snake_case、label = ドメインの label、fields = [])
  assert.match(config, /\n  chat_room: \{ \.\.\.chatRoomConfig, singular: "chat_room", fields: \[\] \},\n  sample: \{ \.\.\.sampleConfig, singular: "sample", fields: \[\] \},\n  sample_category: \{ \.\.\.sampleCategoryConfig, singular: "sample_category", fields: \[\] \},\n  sample_image: \{ \.\.\.sampleImageConfig, singular: "sample_image", fields: \[\] \},\n\} as const;/);
});

test("生成: ドメイン設定は全ての登録を並べる(主でない登録・主の無いドメインの登録も、キー = 登録名、表示名の既定は登録名、D348)", () => {
  const root = fixture({
    ...declared("src/domains/sample", '{ "label": "サンプル", "plural": "samples" }'),
    "src/domains/sample/entities/sampleImage/entity.json": '{ "singular": "sample_image", "plural": "sample_images" }',
    "src/domains/core/messaging/domain.json": JSON.stringify({ domainConfigVersion: "2.0", label: "メッセージ" }),
    "src/domains/core/messaging/entities/messageTemplate/entity.json": '{ "plural": "message_templates" }',
    "src/domains/core/messaging/entities/messageLog/entity.json": '{ "plural": "message_logs" }',
  });
  const { outputs, problems } = buildAlphaRegistries(root);
  rmSync(root, { recursive: true, force: true });
  assert.deepEqual(problems, []);
  const config = outputs[DOMAIN_CONFIG_REGISTRY_FILE];
  assert.match(config, /import sampleImageConfig from "@\/domains\/sample\/entities\/sampleImage\/entity\.json";/);
  assert.match(config, /\n  sample_image: \{ \.\.\.sampleImageConfig, label: "sampleImage", fields: \[\] \},/);
  assert.match(config, /\n  message_template: \{ \.\.\.messageTemplateConfig, singular: "message_template", label: "messageTemplate", fields: \[\] \},/);
  assert.match(config, /\n  message_log: /);
});

test("生成: 集める入口 entities/<種類>.ts は宣言のある全ドメインに、その種類を持つ登録を登録のフォルダの並びで書く(generate: false も)", () => {
  const root = fixture({
    ...declared("src/domains/shop", '{ "plural": "shops" }'),
    "src/domains/shop/entities/shop/drizzle.ts": "export const S = 1;\n",
    "src/domains/shop/entities/shop/schema.ts": "export const s = 1;\n",
    "src/domains/shop/entities/shopItem/entity.json": '{ "plural": "shopItems", "generate": false }',
    "src/domains/shop/entities/shopItem/drizzle.ts": "export const I = 1;\n",
    // domain.json の無いフォルダは宣言の無いドメイン = 入口を書かない
    "src/domains/loose/entities/loose/drizzle.ts": "export const L = 1;\n",
  });
  const { outputs } = buildAlphaRegistries(root);
  rmSync(root, { recursive: true, force: true });
  assert.equal(
    outputs["src/domains/shop/entities/drizzle.ts"],
    [
      "// 生成物・編集不可: pnpm generate registry が src/domains/shop/entities/*/drizzle.ts の並びから生成する",
      "// src/domains/shop/entities/drizzle.ts",
      "// 登録ごとのフォルダ(entities/<登録名>/drizzle.ts)を集めるだけの入口(import の道を変えないため)。中身は各登録のフォルダに書く",
      "",
      'export * from "./shop/drizzle";',
      'export * from "./shopItem/drizzle";',
      "",
    ].join("\n"),
  );
  assert.match(outputs["src/domains/shop/entities/schema.ts"], /\nexport \* from "\.\/shop\/schema";\n$/);
  assert.ok(!("src/domains/shop/entities/form.ts" in outputs), "どの登録も持たない種類は書かない");
  assert.ok(!Object.keys(outputs).some((file) => file.startsWith("src/domains/loose/")), "宣言の無いドメインには書かない");
});

test("生成: ファイル用途の一覧は services/server/<登録名>StoragePurposes.ts を path 順に並べる(core も同じ)", () => {
  const root = mkdtempSync(join(tmpdir(), "alpha-purposes-"));
  for (const [dir, registration] of [["src/domains/album", "album"], ["src/domains/core/coupon", "coupon"]]) {
    mkdirSync(join(root, dir, "services/server"), { recursive: true });
    writeFileSync(join(root, dir, `services/server/${registration}StoragePurposes.ts`), "export const purposes = {};\n");
  }
  const text = buildAlphaRegistries(root).outputs[STORAGE_PURPOSE_REGISTRY_FILE];
  rmSync(root, { recursive: true, force: true });
  assert.match(text, /import \{ purposes as albumPurposes \} from "@\/domains\/album\/services\/server\/albumStoragePurposes";/);
  assert.match(text, /import \{ purposes as couponPurposes \} from "@\/domains\/core\/coupon\/services\/server\/couponStoragePurposes";/);
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

test("管理一覧の一覧: 一覧の画面があるドメインだけ(generate: false も、adminList: false は出さない)、キー = フォルダ名、印の無い addToAdminDataMenu は false", () => {
  const root = fixture({
    ...declared("src/domains/core/chatRoom", '{ "generate": false, "label": "チャット", "plural": "chat_rooms" }'),
    ...declared("src/domains/sample", '{ "label": "サンプル", "plural": "samples", "addToAdminDataMenu": true }'),
    ...declared("src/domains/sampleImage", '{ "label": "画像", "plural": "sample_images", "addToAdminDataMenu": true }'),
    ...declared("src/domains/core/coupon", '{ "generate": false, "label": "クーポン", "plural": "coupons" }'),
    ...declared("src/domains/core/auditLog", '{ "generate": false, "label": "監査ログ", "plural": "audit_logs", "adminList": false }'),
    "src/app/admin/(protected)/audit-logs/page.tsx": "export {};\n",
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
