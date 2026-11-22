// scripts/structure/registry/alpha/recordTargetRegistry.test.mjs
// 記録の宛先の生成の一覧(./recordTargetRegistry.mjs → src/registry/recordTargetRegistry.ts)の回帰テスト。一時ディレクトリの木で動かす。
// - 0 本 = 型つきの空の一覧 / core と業務の 2 つのドメインから集める・鍵の順・ドメインを持つ・遅延 import
// - 止める: 鍵の重なり(両方のファイルを名指す)・鍵が場所とずれる・key がリテラルでない・形が違う・点つきの名前
// - .test・.override は項目として数えない
// - messages: 項目の並び・隣の override の recordTargetOverride.messages が丸ごと差し替える・生成の一覧に override の遅延 import
// - 止める: messages が無い / リテラルの配列でない・名指しの連絡定義が無い・その定義の adminTargets に records が無い(書いていない = records で通る)
// 実行: pnpm test scripts/structure/registry/alpha/recordTargetRegistry.test.mjs

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { renderRecordTargetRegistry, scanRecordTargets } from "./recordTargetRegistry.mjs";

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "record-target-registry-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const item = (key, messages = "[]") =>
  `import type { MessageRecordTarget } from "@/lib/messaging";\nexport const recordTarget: MessageRecordTarget = { key: ${key}, label: "x", messages: ${messages}, resolveRecipients: async () => [] };\n`;
const definition = (key, extra = "") =>
  `import { defineMessage } from "@/lib/messaging";\nexport const message = defineMessage({ key: "${key}", label: "x", category: "notice", layout: "simple"${extra} });\n`;
const override = (body) => `export const recordTargetOverride = { ${body} } satisfies MessageRecordTargetOverride;\n`;
const REVIEW = "src/domains/core/bankTransferReview/recordTargets/";
const SHOP = "src/domains/shop/recordTargets/";
// 地区として見つかるよう、ドメインのフォルダに何か 1 つ置く
const DOMAINS = {
  "src/domains/core/bankTransferReview/README.md": "# bankTransferReview\n",
  "src/domains/shop/README.md": "# shop\n",
};

test("0 本: 型つきの空の一覧", () => {
  const { text, problems } = renderRecordTargetRegistry(fixture(DOMAINS));
  assert.deepEqual(problems, []);
  assert.ok(text.startsWith("// 生成物・編集不可: pnpm generate registry が "));
  assert.ok(text.includes('import "server-only";'));
  assert.ok(text.includes('import type { MessageRecordTargetRegistry } from "@/lib/messaging";'));
  assert.ok(text.includes("export const recordTargetRegistry: MessageRecordTargetRegistry = {};"));
});

test("2 つのドメイン(core と業務)から集め、鍵の順にドメインつきの遅延 import で並べる", () => {
  const root = fixture({
    ...DOMAINS,
    [`${REVIEW}reviews.ts`]: item('"bankTransferReview.reviews"'),
    [`${REVIEW}reviews.test.ts`]: "// テスト\n",
    [`${SHOP}orders.ts`]: item("`shop.orders`"),
  });
  const { entries, problems } = scanRecordTargets(root);
  assert.deepEqual(problems, []);
  assert.deepEqual(entries, [
    { key: "bankTransferReview.reviews", domain: "bankTransferReview", path: `${REVIEW}reviews.ts`, override: null, messages: [] },
    { key: "shop.orders", domain: "shop", path: `${SHOP}orders.ts`, override: null, messages: [] },
  ]);
  const { text } = renderRecordTargetRegistry(root);
  assert.ok(
    text.includes(
      '  "bankTransferReview.reviews": {\n    key: "bankTransferReview.reviews",\n    domain: "bankTransferReview",\n    target: () => import("@/domains/core/bankTransferReview/recordTargets/reviews"),\n  },',
    ),
  );
  assert.ok(text.indexOf('"bankTransferReview.reviews"') < text.indexOf('"shop.orders"'));
});

test("鍵の重なり: core と業務のドメインのフォルダ名が同じなら両方のファイルを名指して止める", () => {
  const root = fixture({
    "src/domains/core/shop/README.md": "# shop\n",
    "src/domains/shop/README.md": "# shop\n",
    "src/domains/core/shop/recordTargets/orders.ts": item('"shop.orders"'),
    [`${SHOP}orders.ts`]: item('"shop.orders"'),
  });
  const { problems } = scanRecordTargets(root);
  assert.equal(problems.length, 1, problems.join("\n"));
  assert.match(problems[0], /鍵 shop\.orders が .* と重なる/);
  assert.ok(problems[0].includes("src/domains/core/shop/recordTargets/orders.ts"));
  assert.ok(problems[0].includes("src/domains/shop/recordTargets/orders.ts"));
});

test("止める: 鍵が場所とずれる・key がリテラルでない・形が違う・点つきの名前", () => {
  const root = fixture({
    ...DOMAINS,
    [`${SHOP}orders.ts`]: item('"shop.other"'),
    [`${SHOP}dynamic.ts`]: item("KEY"),
    [`${SHOP}wrong.ts`]: "export const target = {};\n",
    [`${SHOP}orders.old.ts`]: item('"shop.orders"'),
  });
  const { entries, problems } = scanRecordTargets(root);
  assert.deepEqual(entries, []);
  assert.equal(problems.length, 4, problems.join("\n"));
  assert.ok(problems.some((p) => p.includes(`${SHOP}orders.ts: key "shop.other" は場所から決まる "shop.orders"`)));
  assert.ok(problems.some((p) => p.includes(`${SHOP}dynamic.ts: key は文字列リテラルで書く("shop.dynamic")`)));
  assert.ok(problems.some((p) => p.includes(`${SHOP}wrong.ts: 記録の宛先は export const recordTarget`)));
  assert.ok(problems.some((p) => p.includes(`${SHOP}orders.old.ts: 記録の宛先のファイル名は英小文字始まりの camelCase`)));
});

test("messages: 名指しの連絡定義があり adminTargets に records がある(書いていない = records)なら通る", () => {
  const root = fixture({
    ...DOMAINS,
    "src/domains/shop/messages/shipped.ts": definition("shop.shipped"),
    "src/domains/shop/messages/sale.ts": definition("shop.sale", ', adminTargets: ["records", "all"]'),
    [`${SHOP}orders.ts`]: item('"shop.orders"', '["shop.shipped", "shop.sale"]'),
  });
  const { entries, problems } = scanRecordTargets(root);
  assert.deepEqual(problems, []);
  assert.deepEqual(entries[0].messages, ["shop.shipped", "shop.sale"]);
});

test("止める: 名指しの連絡定義が無い・その定義の adminTargets に records が無い(項目と鍵を名指す)", () => {
  const root = fixture({
    ...DOMAINS,
    "src/domains/shop/messages/sale.ts": definition("shop.sale", ', adminTargets: ["all"]'),
    [`${SHOP}orders.ts`]: item('"shop.orders"', '["shop.missing", "shop.sale"]'),
  });
  const { problems } = scanRecordTargets(root);
  assert.equal(problems.length, 2, problems.join("\n"));
  assert.ok(problems.some((p) => p.startsWith(`${SHOP}orders.ts: messages の shop.missing は連絡定義に無い`) && p.includes("項目 shop.orders")));
  assert.ok(problems.some((p) => p.startsWith(`${SHOP}orders.ts: messages の shop.sale は adminTargets に "records" が無い`) && p.includes("項目 shop.orders")));
});

test("止める: messages が無い・リテラルの配列でない", () => {
  const root = fixture({
    ...DOMAINS,
    [`${SHOP}orders.ts`]: `export const recordTarget = { key: "shop.orders", label: "x", resolveRecipients: async () => [] };\n`,
    [`${SHOP}items.ts`]: item('"shop.items"', "KEYS"),
  });
  const { entries, problems } = scanRecordTargets(root);
  assert.deepEqual(entries, []);
  assert.equal(problems.length, 2, problems.join("\n"));
  assert.ok(problems.some((p) => p.startsWith(`${SHOP}orders.ts: messages(送れる連絡定義の鍵の並び、空も可)`)));
  assert.ok(problems.some((p) => p.startsWith(`${SHOP}items.ts: messages は文字列リテラルの配列で書く`)));
});

test("override: 隣の recordTargetOverride.messages が丸ごと差し替え、検査は override を名指し、一覧に遅延 import", () => {
  const files = {
    ...DOMAINS,
    "src/domains/shop/messages/shipped.ts": definition("shop.shipped"),
    "src/domains/shop/messages/sale.ts": definition("shop.sale", ', adminTargets: ["role"]'),
    [`${REVIEW}reviews.ts`]: item('"bankTransferReview.reviews"'),
    [`${REVIEW}reviews.override.ts`]: override('messages: ["shop.shipped"]'),
  };
  const root = fixture(files);
  const { entries, problems } = scanRecordTargets(root);
  assert.deepEqual(problems, []);
  assert.deepEqual(entries, [
    {
      key: "bankTransferReview.reviews",
      domain: "bankTransferReview",
      path: `${REVIEW}reviews.ts`,
      override: `${REVIEW}reviews.override.ts`,
      messages: ["shop.shipped"],
    },
  ]);
  const { text } = renderRecordTargetRegistry(root);
  assert.ok(text.includes('    override: () => import("@/domains/core/bankTransferReview/recordTargets/reviews.override"),\n'));

  const bad = fixture({ ...files, [`${REVIEW}reviews.override.ts`]: override('messages: ["shop.sale"]') });
  const checked = scanRecordTargets(bad);
  assert.equal(checked.problems.length, 1, checked.problems.join("\n"));
  assert.ok(checked.problems[0].startsWith(`${REVIEW}reviews.override.ts: messages の shop.sale は adminTargets に "records" が無い`));
});
