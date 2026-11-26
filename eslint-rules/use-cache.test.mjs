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
const file = path.join(repoRoot, "src/domains/sample/services/server/cached.ts");

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module", parser: tsParser },
});

const SESSION = `import { getSessionUser } from "@/domains/core/auth/services/server/session/getSessionUser";\n`;

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
      { code: `import { requireCurrentPrincipal as who } from "@/domains/core/pairedDevice/services/server/session";\nexport async function load() {\n  "use cache";\n  const f = async () => who();\n  return f();\n}`, filename: file, errors: [{ messageId: "principal", data: { directive: "use cache", name: "who" } }] },
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
  assert.equal(await count("src/domains/sample/services/server/cached.ts"), 1);
  assert.equal(await count("src/app/(user)/foo/_screen/FooScreen.tsx"), 1);
  assert.equal(await count("src/domains/sample/services/server/cached.test.ts"), 0);
});

const MARK = "// 生成物・編集不可: pnpm generate cache が src/domains/sample/entities/sample/entity.json の cache から生成する\n";
const BASE = `import { postBase } from "./postBase";\n`;

test("rule remote-only-generated: 手書きの remote を止め、生成物・lib/cacheTags・普通の use cache・private は通す", () => {
  ruleTester.run("remote-only-generated", plugin.rules["remote-only-generated"], {
    valid: [
      { code: `${MARK}${BASE}async function get(id: string) {\n  "use cache: remote";\n  return postBase.get(id);\n}`, filename: file },
      { code: `export async function Banner() {\n  "use cache";\n  return "x";\n}`, filename: file },
      { code: `export async function load() {\n  "use cache: private";\n  return 1;\n}`, filename: file },
      { code: `export async function sharedRead() {\n  "use cache: remote";\n  return 1;\n}`, filename: path.join(repoRoot, "src/lib/cacheTags/sharedRead.ts") },
    ],
    invalid: [
      { code: `export async function load() {\n  "use cache: remote";\n  return 1;\n}`, filename: file, errors: [{ messageId: "remote" }] },
      { code: `"use cache: remote";\nexport async function load() {\n  return 1;\n}`, filename: file, errors: [{ messageId: "remote" }] },
      { code: `export const load = async () => {\n  "use cache: remote";\n  return 1;\n};`, filename: file, errors: [{ messageId: "remote" }] },
    ],
  });
});

test("rule no-data-read-in-cache: 共有の cache の中の DB を読む物の直の呼び出しを止め、生成物・範囲の外・private・型だけは通す", () => {
  ruleTester.run("no-data-read-in-cache", plugin.rules["no-data-read-in-cache"], {
    valid: [
      { code: `${MARK}${BASE}async function get(id: string) {\n  "use cache: remote";\n  return postBase.get(id);\n}`, filename: file },
      { code: `${BASE}export async function load(id: string) {\n  return postBase.get(id);\n}`, filename: file },
      { code: `${BASE}export async function load(id: string) {\n  "use cache: private";\n  return postBase.get(id);\n}`, filename: file },
      { code: `import type { postBase } from "./postBase";\nimport { format } from "@/lib/date";\nexport async function load(at: string) {\n  "use cache";\n  return format(at);\n}`, filename: file },
    ],
    invalid: [
      { code: `${BASE}export async function load(id: string) {\n  "use cache";\n  return postBase.get(id);\n}`, filename: file, errors: [{ messageId: "dataRead", data: { directive: "use cache", name: "postBase" } }] },
      { code: `import { db } from "@/lib/drizzle";\nexport async function load() {\n  "use cache";\n  return db.select().from(x);\n}`, filename: file, errors: [{ messageId: "dataRead", data: { directive: "use cache", name: "db" } }] },
      { code: `import { settingService } from "@/domains/core/setting/services/server/settingService";\nexport async function load() {\n  "use cache";\n  const f = async () => settingService.read();\n  return f();\n}`, filename: file, errors: [{ messageId: "dataRead", data: { directive: "use cache", name: "settingService" } }] },
      { code: `"use cache";\nimport { createCrudService } from "@/lib/crud/server";\nexport async function load() {\n  return createCrudService(t, {});\n}`, filename: file, errors: [{ messageId: "dataRead" }] },
    ],
  });
});

test("rule no-manual-revalidate: next/cache の unstable_cache・revalidateTag・updateTag を lib/cacheTags の外で止め、cacheLife・cacheTag は通す", () => {
  ruleTester.run("no-manual-revalidate", plugin.rules["no-manual-revalidate"], {
    valid: [
      { code: `import { revalidateTag } from "next/cache";\nrevalidateTag("x", { expire: 0 });`, filename: path.join(repoRoot, "src/lib/cacheTags/context.ts") },
      { code: `import { cacheLife, cacheTag } from "next/cache";\ncacheLife("days");\ncacheTag("x");`, filename: file },
      { code: `import type { unstable_cache } from "next/cache";`, filename: file },
    ],
    invalid: [
      { code: `import { unstable_cache } from "next/cache";`, filename: file, errors: [{ messageId: "manual", data: { name: "unstable_cache" } }] },
      { code: `import { revalidateTag as drop, updateTag } from "next/cache";`, filename: file, errors: [{ messageId: "manual", data: { name: "revalidateTag" } }, { messageId: "manual", data: { name: "updateTag" } }] },
    ],
  });
});

test("eslint.config.mjs: 3 つの規則が src のコードに当たる", async () => {
  const eslint = new ESLint({ cwd: repoRoot, overrideConfigFile: path.join(repoRoot, "eslint.config.mjs") });
  const code = `import { unstable_cache } from "next/cache";\nimport { postBase } from "./postBase";\nexport async function load(id: string) {\n  "use cache: remote";\n  return postBase.get(id) ?? unstable_cache;\n}\n`;
  const [result] = await eslint.lintText(code, { filePath: path.join(repoRoot, "src/domains/sample/services/server/cached.ts") });
  const rules = new Set(result.messages.map((m) => m.ruleId));
  for (const rule of ["use-cache/remote-only-generated", "use-cache/no-data-read-in-cache", "use-cache/no-manual-revalidate"]) assert.ok(rules.has(rule), rule);
});
