// eslint-rules/import-boundaries.test.mjs
// 層の境目の import の検査(route-factory-via-wiring・page-guard-via-wiring・features-index-no-server-reexport・lib-no-registry)の契約テスト。実行: pnpm test:import-boundaries (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ESLint, RuleTester } from "eslint";

import plugin, {
  classifyFeaturesIndexReexport,
  classifyLibRegistryImport,
  classifyPageGuardImport,
  classifyRouteFactoryImport,
} from "./import-boundaries.mjs";
import { LIB_REGISTRY_EXCEPTIONS } from "./import-boundaries.exceptions.mjs";
import { resolveImport } from "./resolve-import.mjs";

const tsParser = createRequire(import.meta.resolve("eslint-config-next"))("@typescript-eslint/parser");
const repoRoot = path.resolve(import.meta.dirname, "..");
const at = (rel) => path.join(repoRoot, rel);

test("resolveImport: エイリアス・core の別名・相対・baseUrl を同じ実パスに解き、パッケージは null", () => {
  const route = at("src/app/api/foo/route.ts");
  assert.equal(resolveImport("@/lib/routeFactory", route, repoRoot), "src/lib/routeFactory");
  assert.equal(resolveImport("@/lib/routeFactory/createApiRoute", route, repoRoot), "src/lib/routeFactory/createApiRoute");
  assert.equal(resolveImport("src/lib/routeFactory", route, repoRoot), "src/lib/routeFactory");
  assert.equal(resolveImport("../../../lib/routeFactory", route, repoRoot), "src/lib/routeFactory");
  assert.equal(resolveImport("@/features/auth/entities/session", route, repoRoot), "src/features/core/auth/entities/session");
  assert.equal(resolveImport("next/server", route, repoRoot), null);
});

test("classify: routeFactory の値 import は wiring と routeFactory 自身だけ、型は誰でも", () => {
  assert.equal(classifyRouteFactoryImport("src/app/api/foo/route.ts", "src/lib/routeFactory", false), "routeFactory");
  assert.equal(classifyRouteFactoryImport("src/features/x/services/server/a.ts", "src/lib/routeFactory/enforceAccess", false), "routeFactory");
  assert.equal(classifyRouteFactoryImport("src/app/api/foo/route.ts", "src/lib/routeFactory", true), null);
  assert.equal(classifyRouteFactoryImport("src/wiring/apiRoute.ts", "src/lib/routeFactory", false), null);
  assert.equal(classifyRouteFactoryImport("src/wiring/apiRoute.acme.ts", "src/lib/routeFactory", false), null);
  assert.equal(classifyRouteFactoryImport("src/lib/routeFactory/index.ts", "src/lib/routeFactory/createApiRoute", false), null);
  assert.equal(classifyRouteFactoryImport("src/app/api/foo/route.ts", "src/lib/crud", false), null, "createCrudService は対象外");
  assert.equal(classifyRouteFactoryImport("src/app/api/cron/x/route.ts", "src/lib/cron", false), null, "lib/cron は対象外");
});

test("classify: lib → registry は値も型も禁止、一覧の行(file + target)だけ通す", () => {
  const ex = [{ file: "src/lib/a/index.ts", target: "src/registry/fooRegistry", reason: "" }];
  assert.equal(classifyLibRegistryImport("src/lib/a/index.ts", "src/registry/fooRegistry", ex), "listed");
  assert.equal(classifyLibRegistryImport("src/lib/a/index.ts", "src/registry/barRegistry", ex), "libRegistry", "同じファイルでも別の登録表は不可");
  assert.equal(classifyLibRegistryImport("src/lib/b/index.ts", "src/registry/fooRegistry", ex), "libRegistry");
  assert.equal(classifyLibRegistryImport("src/features/x/a.ts", "src/registry/fooRegistry", ex), null, "lib の外は対象外");
  assert.equal(classifyLibRegistryImport("src/lib/b/index.ts", "src/lib/domain", ex), null);
});

test("例外の一覧: 行のファイルは実在し、登録表は src/registry の下", () => {
  for (const e of LIB_REGISTRY_EXCEPTIONS) {
    assert.ok(existsSync(at(e.file)), `${e.file} が無い(一覧から行を消す)`);
    assert.ok(e.target.startsWith("src/registry/"), `${e.target} は src/registry の下でない`);
    assert.ok(e.reason, `${e.file} に理由が無い`);
  }
});

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module", parser: tsParser },
});

test("rule route-factory-via-wiring: エイリアス・相対・baseUrl・サブパス・dynamic import を止め、型と wiring は通す", () => {
  const route = at("src/app/api/foo/route.ts");
  ruleTester.run("route-factory-via-wiring", plugin.rules["route-factory-via-wiring"], {
    valid: [
      { code: `import { createApiRoute } from "@/wiring/apiRoute";`, filename: route },
      { code: `import type { RouteAccess } from "@/lib/routeFactory";`, filename: route },
      { code: `import { type RouteAccess } from "@/lib/routeFactory";`, filename: route },
      { code: `import { createRouteFactories } from "@/lib/routeFactory";`, filename: at("src/wiring/apiRoute.ts") },
      { code: `import { createRouteFactories } from "@/lib/routeFactory";`, filename: at("src/wiring/apiRoute.acme.ts") },
      { code: `import { makeRouteCore } from "./createApiRoute";`, filename: at("src/lib/routeFactory/createRouteFactories.ts") },
    ],
    invalid: [
      { code: `import { createRouteFactories } from "@/lib/routeFactory";`, filename: route, errors: [{ messageId: "routeFactory" }] },
      { code: `import { ownerWhere } from "src/lib/routeFactory";`, filename: route, errors: [{ messageId: "routeFactory" }] },
      { code: `import { x } from "../../../lib/routeFactory/enforceAccess";`, filename: route, errors: [{ messageId: "routeFactory" }] },
      { code: `const m = await import("@/lib/routeFactory");`, filename: route, errors: [{ messageId: "routeFactory" }] },
      { code: `export { ownerWhere } from "@/lib/routeFactory";`, filename: at("src/features/x/index.ts"), errors: [{ messageId: "routeFactory" }] },
    ],
  });
});

test("rule lib-no-registry: 値も型も止め、一覧の行は通し、使わなくなった行は error", () => {
  const listed = LIB_REGISTRY_EXCEPTIONS[0];
  ruleTester.run("lib-no-registry", plugin.rules["lib-no-registry"], {
    valid: [
      { code: `import { x } from "@/lib/domain";`, filename: at("src/lib/foo/index.ts") },
      { code: `import * as schema from "@/registry/schemaRegistry";`, filename: at(listed.file) },
    ],
    invalid: [
      { code: `import { serviceRegistry } from "@/registry/serviceRegistry";`, filename: at("src/lib/foo/index.ts"), errors: [{ messageId: "libRegistry" }] },
      { code: `import type { PairedDeviceKind } from "@/registry/pairedDeviceKindRegistry";`, filename: at("src/lib/foo/index.ts"), errors: [{ messageId: "libRegistry" }] },
      { code: `import { x } from "../../registry/fooRegistry";`, filename: at("src/lib/foo/index.ts"), errors: [{ messageId: "libRegistry" }] },
      { code: `export const x = 1;`, filename: at(listed.file), errors: [{ messageId: "staleException" }] },
    ],
  });
});

// eslint.config.mjs の当て方(全 Tier error・lib のテストは lib-no-registry の対象外)を実ファイルパスで確かめる
const lintAt = async (filePath, code) => {
  const eslint = new ESLint({ cwd: repoRoot, overrideConfigFile: path.join(repoRoot, "eslint.config.mjs") });
  const [result] = await eslint.lintText(code, { filePath: at(filePath) });
  return result.messages.filter((m) => m.ruleId?.startsWith("import-boundaries/")).map((m) => `${m.ruleId}:${m.severity}`);
};

test("config: route・features・scripts で routeFactory の値 import は error、lib の registry import は error(テストは対象外)", async () => {
  const RF = `import { createRouteFactories } from "@/lib/routeFactory";\nexport const x = createRouteFactories;\n`;
  const REG = `import { serviceRegistry } from "@/registry/serviceRegistry";\nexport const x = serviceRegistry;\n`;
  assert.deepEqual(await lintAt("src/app/api/foo/route.ts", RF), ["import-boundaries/route-factory-via-wiring:2"]);
  assert.deepEqual(await lintAt("src/features/sample/services/server/foo.ts", RF), ["import-boundaries/route-factory-via-wiring:2"]);
  assert.deepEqual(await lintAt("scripts/foo/run.ts", RF), ["import-boundaries/route-factory-via-wiring:2"]);
  assert.deepEqual(await lintAt("src/wiring/apiRoute.acme.ts", RF), []);
  assert.deepEqual(await lintAt("src/lib/foo/index.ts", REG), ["import-boundaries/lib-no-registry:2"]);
  assert.deepEqual(await lintAt("src/lib/foo/foo.test.mjs", REG), []);
  assert.deepEqual(await lintAt("src/features/sample/services/server/foo.ts", REG), []);
});

test("classify: pageGuard の値 import は wiring と pageGuard 自身だけ、型は誰でも(L1.18)", () => {
  assert.equal(classifyPageGuardImport("src/app/guard.ts", "src/lib/pageGuard", false), "pageGuard");
  assert.equal(classifyPageGuardImport("src/features/core/auth/services/server/pageGuardUserDeps.ts", "src/lib/pageGuard", false), "pageGuard");
  assert.equal(classifyPageGuardImport("src/features/core/auth/services/server/pageGuardUserDeps.ts", "src/lib/pageGuard", true), null);
  assert.equal(classifyPageGuardImport("src/wiring/pageGuard.ts", "src/lib/pageGuard", false), null);
  assert.equal(classifyPageGuardImport("src/wiring/pageGuard.acme.ts", "src/lib/pageGuard", false), null);
  assert.equal(classifyPageGuardImport("src/lib/pageGuard/index.ts", "src/lib/pageGuard/createPageGuard", false), null);
});

test("classify: features の index.ts は services/server を値で再 export しない(D73 K5)", () => {
  const server = "src/features/core/user/services/server/userService";
  assert.equal(classifyFeaturesIndexReexport("src/features/core/user/index.ts", server, false, true), "serverReexport");
  assert.equal(classifyFeaturesIndexReexport("src/features/sample/index.tsx", server, false, true), "serverReexport");
  assert.equal(classifyFeaturesIndexReexport("src/features/core/user/index.ts", server, true, true), null, "型だけは可");
  assert.equal(classifyFeaturesIndexReexport("src/features/core/user/services/server/index.ts", server, false, true), null, "services/server の中の barrel は対象外");
  assert.equal(classifyFeaturesIndexReexport("src/features/core/user/index.ts", "src/features/core/user/hooks/useUser", false, true), null);
  assert.equal(classifyFeaturesIndexReexport("src/features/core/user/index.ts", server, false, false), null, "再 export でない import は対象外");
});

test("rule page-guard-via-wiring / features-index-no-server-reexport: 値は止め、型と許可の場所は通す", () => {
  const guard = at("src/app/x/guard.ts");
  ruleTester.run("page-guard-via-wiring", plugin.rules["page-guard-via-wiring"], {
    valid: [
      { code: `import { defineRootGuard } from "@/wiring/pageGuard";`, filename: guard },
      { code: `import type { PageGuardDeps } from "@/lib/pageGuard";`, filename: at("src/features/core/auth/services/server/pageGuardUserDeps.ts") },
      { code: `import { createPageGuard } from "@/lib/pageGuard";`, filename: at("src/wiring/pageGuard.ts") },
    ],
    invalid: [
      { code: `import { createPageGuard } from "@/lib/pageGuard";`, filename: guard, errors: [{ messageId: "pageGuard" }] },
      { code: `import { createPageGuard } from "src/lib/pageGuard/createPageGuard";`, filename: guard, errors: [{ messageId: "pageGuard" }] },
    ],
  });
  const index = at("src/features/core/user/index.ts");
  ruleTester.run("features-index-no-server-reexport", plugin.rules["features-index-no-server-reexport"], {
    valid: [
      { code: `export type { User } from "./services/server/userService";`, filename: index },
      { code: `export { type UserSignupSummary } from "./services/server/finders/findSignupSummariesByIds";`, filename: index },
      { code: `export { useUser } from "./hooks/useUser";`, filename: index },
    ],
    invalid: [
      { code: `export { userService } from "./services/server/userService";`, filename: index, errors: [{ messageId: "serverReexport" }] },
      { code: `export * from "@/features/core/user/services/server/userService";`, filename: index, errors: [{ messageId: "serverReexport" }] },
    ],
  });
});

test("config: pageGuard の値 import は wiring の外で error、features の index.ts の services/server の値の再 export は error", async () => {
  const PG = `import { createPageGuard } from "@/lib/pageGuard";\nexport const x = createPageGuard;\n`;
  assert.deepEqual(await lintAt("src/app/x/guard.ts", PG), ["import-boundaries/page-guard-via-wiring:2"]);
  assert.deepEqual(await lintAt("src/wiring/pageGuard.acme.ts", PG), []);
  const RE = `export { userService } from "@/features/core/user/services/server/userService";\n`;
  assert.deepEqual(await lintAt("src/features/core/user/index.ts", RE), ["import-boundaries/features-index-no-server-reexport:2"]);
  assert.deepEqual(await lintAt("src/features/core/user/services/server/index.ts", RE), []);
});
