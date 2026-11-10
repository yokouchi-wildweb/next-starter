// scripts/structure/registry/alpha/messageRegistry.test.mjs
// 連絡の生成の一覧(./messageRegistry.mjs → src/registry/messageRegistry.ts)の回帰テスト。一時ディレクトリの木で動かす。
// - 0 本 = 型つきの空の一覧 / 定義だけ / 上書き・描き方つき / 鍵の順 / core と業務の 2 つの置き場
// - 止める: 鍵が場所(<フォルダ名>.<ファイル名>)とずれる・key がリテラルでない・定義の形が違う・点つきの名前・定義の無い描き方・鍵の重なり
// - .override・.test・views の .default / .replace は定義として数えない
// 実行: pnpm test scripts/structure/registry/alpha/messageRegistry.test.mjs

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { renderMessageRegistry, scanMessages } from "./messageRegistry.mjs";

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "message-registry-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const def = (key) => `import { defineMessage } from "@/lib/messaging";\nexport const message = defineMessage({ key: ${key}, kind: "transactional" });\n`;
const AUTH = "src/features/core/auth/messages/";
const SHOP = "src/features/shop/messages/";
// 地区として見つかるよう、ドメインのフォルダに何か 1 つ置く
const DOMAINS = {
  "src/features/core/auth/README.md": "# auth\n",
  "src/features/shop/README.md": "# shop\n",
};

test("0 本: 型つきの空の一覧", () => {
  const { text, problems } = renderMessageRegistry(fixture(DOMAINS));
  assert.deepEqual(problems, []);
  assert.ok(text.startsWith("// 生成物・編集不可: pnpm generate registry が "));
  assert.ok(text.includes('import "server-only";'));
  assert.ok(text.includes('import type { MessageRegistry } from "@/lib/messaging";'));
  assert.ok(text.includes("export const messageRegistry: MessageRegistry = {};"));
});

test("定義・上書き・描き方を鍵の順に並べ、遅延 import にする", () => {
  const root = fixture({
    ...DOMAINS,
    [`${AUTH}verification.ts`]: def('"auth.verification"'),
    [`${AUTH}verification.override.ts`]: "export const messageOverride = {};\n",
    [`${AUTH}views/verification.tsx`]: 'export { default } from "./verification.default";\n',
    [`${AUTH}views/verification.default.tsx`]: "export default function V() { return null; }\n",
    [`${AUTH}accountLocked.ts`]: def('"auth.accountLocked"'),
    [`${AUTH}accountLocked.test.ts`]: "// テスト\n",
    [`${SHOP}orderShipped.ts`]: def("`shop.orderShipped`"),
  });
  const { entries, problems } = scanMessages(root);
  assert.deepEqual(problems, []);
  assert.deepEqual(entries, [
    { key: "auth.accountLocked", definition: `${AUTH}accountLocked.ts`, override: null, view: null },
    { key: "auth.verification", definition: `${AUTH}verification.ts`, override: `${AUTH}verification.override.ts`, view: `${AUTH}views/verification.tsx` },
    { key: "shop.orderShipped", definition: `${SHOP}orderShipped.ts`, override: null, view: null },
  ]);
  const { text } = renderMessageRegistry(root);
  assert.ok(text.includes('  "auth.verification": {\n    key: "auth.verification",\n    definition: () => import("@/features/core/auth/messages/verification"),\n    override: () => import("@/features/core/auth/messages/verification.override"),\n    view: () => import("@/features/core/auth/messages/views/verification"),\n  },'));
  assert.ok(text.includes('  "shop.orderShipped": {\n    key: "shop.orderShipped",\n    definition: () => import("@/features/shop/messages/orderShipped"),\n  },'));
  assert.ok(text.indexOf('"auth.accountLocked"') < text.indexOf('"auth.verification"'));
});

test("止める: 鍵のずれ・リテラルでない key・定義の形・点つきの名前・定義の無い描き方", () => {
  const problemsOf = (files) => scanMessages(fixture({ ...DOMAINS, ...files })).problems;
  assert.match(problemsOf({ [`${AUTH}verification.ts`]: def('"auth.verify"') })[0], /"auth\.verification"/);
  assert.match(problemsOf({ [`${AUTH}verification.ts`]: def("KEY") })[0], /key は文字列リテラル/);
  assert.match(problemsOf({ [`${AUTH}verification.ts`]: "export default {};\n" })[0], /export const message = defineMessage/);
  assert.match(problemsOf({ [`${AUTH}verification.fork.ts`]: def('"auth.verification"') })[0], /camelCase/);
  assert.match(problemsOf({ [`${AUTH}views/welcome.tsx`]: "export {};\n" })[0], /連絡の定義 .*welcome\.ts が無い/);
});

test("止める: core と業務の同じフォルダ名で鍵が重なる", () => {
  const problems = scanMessages(
    fixture({
      "src/features/core/shop/README.md": "# shop\n",
      "src/features/shop/README.md": "# shop\n",
      "src/features/core/shop/messages/orderShipped.ts": def('"shop.orderShipped"'),
      "src/features/shop/messages/orderShipped.ts": def('"shop.orderShipped"'),
    }),
  ).problems;
  assert.ok(problems.some((p) => /鍵 shop\.orderShipped が .* と重なる/.test(p)), problems.join(" / "));
});
