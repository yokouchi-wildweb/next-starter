// eslint-rules/raw-elements.test.mjs
// 実行: pnpm test eslint-rules/raw-elements.test.mjs

import { RuleTester } from "eslint";
import assert from "node:assert/strict";
import { test } from "node:test";

import plugin, { WRAPPERS } from "./raw-elements.mjs";

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: "latest", sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
});

test("raw-elements: 包みのある要素は止め、包みの無い要素・飾り・名前つき・部品は通す", () => {
  ruleTester.run("no-raw-element", plugin.rules["no-raw-element"], {
    valid: [
      ...["ul", "li", "dl", "dt", "dd", "select", "option", "form", "pre", "code", "br", "strong", "iframe", "html", "body", "script"].map((t) => ({
        code: `const x = <${t} />;`,
      })),
      ...["svg", "path", "video", "canvas", "audio"].map((t) => ({ code: `const x = <${t} />;` })),
      { code: `const x = <motion.div animate={{ x: 1 }} />;` },
      { code: `const x = <Block><Para>t</Para></Block>;` },
      { code: `const x = <Layout.Block />;` },
    ],
    invalid: Object.keys(WRAPPERS).map((t) => ({ code: `const x = <${t}>t</${t}>;`, errors: [{ messageId: "raw", data: { tag: t, wrapper: WRAPPERS[t] } }] })),
  });
});

test("案内の表は包みのある要素だけ(包みの無い ul・select は入れない)", () => {
  for (const t of ["ul", "li", "select", "option", "form", "svg", "video"]) assert.equal(Object.hasOwn(WRAPPERS, t), false, t);
});
