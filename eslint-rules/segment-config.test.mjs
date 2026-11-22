// eslint-rules/segment-config.test.mjs
// cacheComponents と両立しない segment config の検査の契約テスト。実行: pnpm test eslint-rules/segment-config.test.mjs (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { ESLint, RuleTester } from "eslint";

import plugin, { CC_INCOMPATIBLE_SEGMENT_CONFIG } from "./segment-config.mjs";

const tsParser = createRequire(import.meta.resolve("eslint-config-next"))("@typescript-eslint/parser");
const repoRoot = path.resolve(import.meta.dirname, "..");
const page = path.join(repoRoot, "src/app/(user)/foo/page.tsx");
const layout = path.join(repoRoot, "src/app/(user)/foo/layout.tsx");
const route = path.join(repoRoot, "src/app/api/foo/route.ts");

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module", parser: tsParser },
});

test("止める名は 5 つ(dynamic・dynamicParams・fetchCache・revalidate・runtime)", () => {
  assert.deepEqual([...CC_INCOMPATIBLE_SEGMENT_CONFIG].sort(), ["dynamic", "dynamicParams", "fetchCache", "revalidate", "runtime"]);
});

test("rule cc-incompatible: 5 つの名の export を止め、cacheComponents でも使える名は通す", () => {
  ruleTester.run("cc-incompatible", plugin.rules["cc-incompatible"], {
    valid: [
      { code: `export { FooScreen as default } from "./_screen/FooScreen";`, filename: page },
      { code: `export { FooScreen as default, metadata } from "./_screen/FooScreen";`, filename: page },
      { code: `export const metadata = { title: "x" };\nexport const viewport = {};`, filename: page },
      { code: `export const maxDuration = 300;\nexport const preferredRegion = "hnd1";`, filename: route },
      { code: `export async function generateMetadata() { return {}; }`, filename: page },
      { code: `export type dynamic = string;`, filename: page },
      { code: `const dynamic = "force-dynamic";\nvoid dynamic;`, filename: page },
    ],
    invalid: [
      { code: `export const dynamic = "force-dynamic";`, filename: page, errors: [{ messageId: "incompatible", data: { name: "dynamic" } }] },
      { code: `export const dynamic = "force-dynamic";`, filename: layout, errors: [{ messageId: "incompatible" }] },
      { code: `export const runtime = "nodejs";`, filename: route, errors: [{ messageId: "incompatible", data: { name: "runtime" } }] },
      { code: `export const revalidate = 60;\nexport const fetchCache = "force-no-store";`, filename: page, errors: [{ messageId: "incompatible" }, { messageId: "incompatible" }] },
      { code: `export let dynamicParams = false;`, filename: page, errors: [{ messageId: "incompatible", data: { name: "dynamicParams" } }] },
      { code: `const d = "force-dynamic";\nexport { d as dynamic };`, filename: page, errors: [{ messageId: "incompatible" }] },
      { code: `export { revalidate } from "./config";`, filename: page, errors: [{ messageId: "incompatible" }] },
      { code: `export const { revalidate } = { revalidate: 60 };`, filename: page, errors: [{ messageId: "incompatible" }] },
    ],
  });
});

test("eslint.config.mjs: page・layout・route に当たり、他のファイルには当たらない", async () => {
  const eslint = new ESLint({ cwd: repoRoot, overrideConfigFile: path.join(repoRoot, "eslint.config.mjs") });
  const code = `export const dynamic = "force-dynamic";\n`;
  const ruleIdOf = async (file) => {
    const [result] = await eslint.lintText(code, { filePath: path.join(repoRoot, file) });
    return result.messages.filter((m) => m.ruleId === "segment-config/cc-incompatible").length;
  };
  assert.equal(await ruleIdOf("src/app/(user)/foo/page.tsx"), 1);
  assert.equal(await ruleIdOf("src/app/(user)/foo/layout.tsx"), 1);
  assert.equal(await ruleIdOf("src/app/api/foo/route.ts"), 1);
  assert.equal(await ruleIdOf("src/app/(user)/foo/_screen/FooScreen.tsx"), 0);
  assert.equal(await ruleIdOf("src/domains/sample/constants/index.ts"), 0);
});
