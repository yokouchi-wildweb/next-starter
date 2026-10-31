// eslint-rules/no-server-action.test.mjs
// 実行: pnpm test:no-server-action

import { RuleTester } from "eslint";
import { test } from "node:test";

import plugin from "./no-server-action.mjs";

const ruleTester = new RuleTester({ languageOptions: { ecmaVersion: "latest", sourceType: "module" } });

test("no-server-action: ファイルの先頭と関数の中を止め、他は通す", () => {
  ruleTester.run("no-server-action", plugin.rules["no-server-action"], {
    valid: [
      { code: `"use client";\nexport const a = 1;` },
      { code: `const text = "use server";\nexport { text };` },
      { code: `f("use server");` },
    ],
    invalid: [
      { code: `"use server";\nexport async function a() {}`, errors: [{ messageId: "serverAction" }] },
      { code: `export async function a() {\n  "use server";\n  return 1;\n}`, errors: [{ messageId: "serverAction" }] },
      { code: `export const a = async () => {\n  "use server";\n};`, errors: [{ messageId: "serverAction" }] },
    ],
  });
});
