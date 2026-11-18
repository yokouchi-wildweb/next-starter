// eslint-rules/asset-paths.test.mjs
// 実行: pnpm test eslint-rules/asset-paths.test.mjs

import { RuleTester } from "eslint";
import assert from "node:assert/strict";
import { test } from "node:test";

import plugin, { isLiteralAssetPath } from "./asset-paths.mjs";

const ruleTester = new RuleTester({ languageOptions: { ecmaVersion: "latest", sourceType: "module" } });

test("isLiteralAssetPath: /assets/ と / で始まる資産の拡張子を捕まえ、URL・API・ほかの文字は通す", () => {
  for (const v of ["/assets/imgs/a.png", "/assets/videos/x", "/og-default.png", "/images/a.JPG", "/se/click.mp3"]) assert.equal(isLiteralAssetPath(v), true, v);
  for (const v of ["//cdn.example.com/a.png", "https://example.com/a.png", "storage://bucket/a.png", "/api/files", "a.png", "/a b.png", ""]) {
    assert.equal(isLiteralAssetPath(v), false, v);
  }
});

test("asset-paths: 文字列・式なしのテンプレートの直書きを止め、組み立て役の呼び出しと式のテンプレートは通す", () => {
  ruleTester.run("no-literal-asset-path", plugin.rules["no-literal-asset-path"], {
    valid: [
      { code: `import { imgPath } from "@/utils/assets"; const src = imgPath("logo.png");` },
      { code: `const url = "https://example.com/og.png";` },
      { code: "const src = `/assets/imgs/${name}`;" },
      { code: `const route = "/api/wallet/purchase";` },
    ],
    invalid: [
      { code: `const src = "/assets/imgs/logo.png";`, errors: [{ messageId: "literal" }] },
      { code: `const og = "/og-default.png";`, errors: [{ messageId: "literal" }] },
      { code: "const v = `/assets/videos/intro.mp4`;", errors: [{ messageId: "literal" }] },
      { code: `const el = { src: "/images/a.webp" };`, errors: [{ messageId: "literal" }] },
    ],
  });
});
