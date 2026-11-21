// eslint-rules/use-cache.test.mjs
// 共有の use cache の中で利用者・権限を引数の外から読まない検査の契約テスト。実行: pnpm test eslint-rules/use-cache.test.mjs (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { ESLint, RuleTester } from "eslint";

import plugin from "./use-cache.mjs";

const tsParser = createRequire(import.meta.resolve("eslint-config-next"))("@typescript-eslint/parser");
const repoRoot = path.resolve(import.meta.dirname, "..");
const file = path.join(repoRoot, "src/features/sample/services/server/cached.ts");

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module", parser: tsParser },
});

const SESSION = `import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";\n`;

test("rule no-principal-outside-args: 共有の範囲の中の主体の読みを止め、引数・private・範囲の外は通す", () => {
  ruleTester.run("no-principal-outside-args", plugin.rules["no-principal-outside-args"], {
    valid: [
      // 引数で受ける(呼ぶ側で解いて渡す)
      { code: `export async function load(userId: string) {\n  "use cache";\n  return userId;\n}`, filename: file },
      // private の中は通す
      { code: `${SESSION}export async function load() {\n  "use cache: private";\n  return getSessionUser();\n}`, filename: file },
      // ファイルの頭が private
      { code: `"use cache: private";\n${SESSION}export async function load() {\n  return getSessionUser();\n}`, filename: file },
      // 範囲の外(cache の無い関数)
      { code: `${SESSION}export async function load() {\n  return getSessionUser();\n}`, filename: file },
      // cache の関数を呼ぶ側で解いて渡す
      { code: `${SESSION}async function cached(id: string) {\n  "use cache";\n  return id;\n}\nexport async function load() {\n  const u = await getSessionUser();\n  return cached(u!.userId);\n}`, filename: file },
      // 同じ名前でも監視の外から import した物(next/headers 以外の cookies)
      { code: `import { cookies } from "./cookies";\nexport async function load() {\n  "use cache";\n  return cookies();\n}`, filename: file },
    ],
    invalid: [
      // ファイルの頭の use cache の中の getSessionUser
      { code: `"use cache";\n${SESSION}export async function load() {\n  return getSessionUser();\n}`, filename: file, errors: [{ messageId: "principal", data: { directive: "use cache", name: "getSessionUser" } }] },
      // 関数の use cache の中の cookies()
      { code: `import { cookies } from "next/headers";\nexport async function load() {\n  "use cache";\n  return (await cookies()).get("x");\n}`, filename: file, errors: [{ messageId: "principal", data: { directive: "use cache", name: "cookies" } }] },
      // remote の中の getAuditContext(監査の文脈の主体)
      { code: `import { getAuditContext } from "@/lib/audit";\nexport async function load() {\n  "use cache: remote";\n  return getAuditContext();\n}`, filename: file, errors: [{ messageId: "principal", data: { directive: "use cache: remote", name: "getAuditContext" } }] },
      // 別名の import と入れ子の関数(範囲を引き継ぐ)
      { code: `import { requireCurrentPrincipal as who } from "@/features/core/pairedDevice/services/server/session";\nexport async function load() {\n  "use cache";\n  const f = async () => who();\n  return f();\n}`, filename: file, errors: [{ messageId: "principal", data: { directive: "use cache", name: "who" } }] },
      // import が後ろにあっても判じる
      { code: `export async function load() {\n  "use cache";\n  return headers();\n}\nimport { headers } from "next/headers";`, filename: file, errors: [{ messageId: "principal", data: { directive: "use cache", name: "headers" } }] },
    ],
  });
});

test("eslint.config.mjs: src のコードに当たり、テストには当たらない", async () => {
  const eslint = new ESLint({ cwd: repoRoot, overrideConfigFile: path.join(repoRoot, "eslint.config.mjs") });
  const code = `import { cookies } from "next/headers";\nexport async function load() {\n  "use cache";\n  return (await cookies()).get("x");\n}\n`;
  const count = async (rel) => {
    const [result] = await eslint.lintText(code, { filePath: path.join(repoRoot, rel) });
    return result.messages.filter((m) => m.ruleId === "use-cache/no-principal-outside-args").length;
  };
  assert.equal(await count("src/features/sample/services/server/cached.ts"), 1);
  assert.equal(await count("src/app/(user)/foo/_screen/FooScreen.tsx"), 1);
  assert.equal(await count("src/features/sample/services/server/cached.test.ts"), 0);
});
