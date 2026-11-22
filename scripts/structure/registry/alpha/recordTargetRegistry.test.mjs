// scripts/structure/registry/alpha/recordTargetRegistry.test.mjs
// 記録の宛先の生成の一覧(./recordTargetRegistry.mjs → src/registry/recordTargetRegistry.ts)の回帰テスト。一時ディレクトリの木で動かす。
// - 0 本 = 型つきの空の一覧 / core と業務の 2 つのドメインから集める・鍵の順・ドメインを持つ・遅延 import
// - 止める: 鍵の重なり(両方のファイルを名指す)・鍵が場所とずれる・key がリテラルでない・形が違う・点つきの名前
// - .test は項目として数えない
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

const item = (key) =>
  `import type { MessageRecordTarget } from "@/lib/messaging";\nexport const recordTarget: MessageRecordTarget = { key: ${key}, label: "x", resolveRecipients: async () => [] };\n`;
const REVIEW = "src/features/core/bankTransferReview/recordTargets/";
const SHOP = "src/features/shop/recordTargets/";
// 地区として見つかるよう、ドメインのフォルダに何か 1 つ置く
const DOMAINS = {
  "src/features/core/bankTransferReview/README.md": "# bankTransferReview\n",
  "src/features/shop/README.md": "# shop\n",
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
    { key: "bankTransferReview.reviews", domain: "bankTransferReview", path: `${REVIEW}reviews.ts` },
    { key: "shop.orders", domain: "shop", path: `${SHOP}orders.ts` },
  ]);
  const { text } = renderRecordTargetRegistry(root);
  assert.ok(
    text.includes(
      '  "bankTransferReview.reviews": {\n    key: "bankTransferReview.reviews",\n    domain: "bankTransferReview",\n    target: () => import("@/features/core/bankTransferReview/recordTargets/reviews"),\n  },',
    ),
  );
  assert.ok(text.indexOf('"bankTransferReview.reviews"') < text.indexOf('"shop.orders"'));
});

test("鍵の重なり: core と業務のドメインのフォルダ名が同じなら両方のファイルを名指して止める", () => {
  const root = fixture({
    "src/features/core/shop/README.md": "# shop\n",
    "src/features/shop/README.md": "# shop\n",
    "src/features/core/shop/recordTargets/orders.ts": item('"shop.orders"'),
    [`${SHOP}orders.ts`]: item('"shop.orders"'),
  });
  const { problems } = scanRecordTargets(root);
  assert.equal(problems.length, 1, problems.join("\n"));
  assert.match(problems[0], /鍵 shop\.orders が .* と重なる/);
  assert.ok(problems[0].includes("src/features/core/shop/recordTargets/orders.ts"));
  assert.ok(problems[0].includes("src/features/shop/recordTargets/orders.ts"));
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
