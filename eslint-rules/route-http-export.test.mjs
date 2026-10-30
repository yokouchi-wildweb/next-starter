// eslint-rules/route-http-export.test.mjs
// route.ts の HTTP の export の検査の契約テスト。実行: pnpm test:route-http-export (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { ESLint, RuleTester } from "eslint";

import plugin from "./route-http-export.mjs";

const tsParser = createRequire(import.meta.resolve("eslint-config-next"))("@typescript-eslint/parser");
const repoRoot = path.resolve(import.meta.dirname, "..");
const route = path.join(repoRoot, "src/app/api/foo/route.ts");

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module", parser: tsParser },
});

test("rule http-export: wiring の Factory と lib/cron の作り手だけを通す", () => {
  ruleTester.run("http-export", plugin.rules["http-export"], {
    valid: [
      { code: `import { createApiRoute } from "@/wiring/apiRoute";\nexport const GET = createApiRoute({}, async () => ({}));`, filename: route },
      { code: `import { createApiRoute } from "@/wiring/apiRoute";\ntype P = { id: string };\nexport const POST = createApiRoute<P>({}, async () => ({}));`, filename: route },
      { code: `import { createDomainRoute as make } from "src/wiring/apiRoute";\nexport const GET = make({}, async () => ({}));`, filename: route },
      { code: `import { createAcmeRoute } from "@/wiring/acmeRoute.acme";\nexport const GET = createAcmeRoute({}, async () => ({}));`, filename: route },
      { code: `import { createCronTaskRoute } from "@/lib/cron";\nimport { cronTask } from "./task";\nexport const GET = createCronTaskRoute(cronTask);`, filename: route },
      { code: `export const GET = createApiRoute({}, async () => ({}));\nimport { createApiRoute } from "@/wiring/apiRoute";`, filename: route },
      { code: `import { createApiRoute } from "@/wiring/apiRoute";\nexport const dynamic = "force-dynamic";\nexport const GET = createApiRoute({}, async () => ({}));`, filename: route },
    ],
    invalid: [
      { code: `export async function GET() { return new Response("x"); }`, filename: route, errors: [{ messageId: "shape" }] },
      { code: `export const POST = async () => new Response("x");`, filename: route, errors: [{ messageId: "notFactory" }] },
      { code: `import { createRouteFactories } from "@/lib/routeFactory";\nconst f = createRouteFactories({});\nexport const GET = f.createApiRoute({}, async () => ({}));`, filename: route, errors: [{ messageId: "notFactory" }] },
      { code: `import { verifyCronRequest } from "@/lib/cron";\nexport const GET = verifyCronRequest();`, filename: route, errors: [{ messageId: "notFactory" }] },
      { code: `import { handler } from "./handler";\nexport const GET = handler;`, filename: route, errors: [{ messageId: "notFactory" }] },
      { code: `const GET = () => {};\nexport { GET };`, filename: route, errors: [{ messageId: "shape" }] },
      { code: `export { GET } from "./other";`, filename: route, errors: [{ messageId: "shape" }] },
      { code: `import { createApiRoute } from "@/wiring/apiRoute";\nexport const { GET } = { GET: createApiRoute({}, async () => ({})) };`, filename: route, errors: [{ messageId: "shape" }] },
      { code: `export * from "./other";`, filename: route, errors: [{ messageId: "shape" }] },
    ],
  });
});

const lintAt = async (filePath, code) => {
  const eslint = new ESLint({ cwd: repoRoot, overrideConfigFile: path.join(repoRoot, "eslint.config.mjs") });
  const [result] = await eslint.lintText(code, { filePath: path.join(repoRoot, filePath) });
  return result.messages.filter((m) => m.ruleId?.startsWith("route-http-export/")).map((m) => `${m.ruleId}:${m.severity}`);
};

test("config: src/app の route.ts は api の外も error、route.ts 以外は対象外", async () => {
  const RAW = `export async function GET() { return new Response("x"); }\n`;
  assert.deepEqual(await lintAt("src/app/api/foo/route.ts", RAW), ["route-http-export/http-export:2"]);
  assert.deepEqual(await lintAt("src/app/(user)/demo/check-env/api/route.ts", RAW), ["route-http-export/http-export:2"]);
  assert.deepEqual(await lintAt("src/app/api/foo/handler.ts", RAW), []);
});
