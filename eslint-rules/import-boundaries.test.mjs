// eslint-rules/import-boundaries.test.mjs
// 層の境目の import の検査(route-factory-via-wiring・page-guard-via-wiring・cron-route-via-wiring・features-index-no-server-reexport・lib-no-registry・feature-gate-entries)の契約テスト。実行: pnpm test:import-boundaries (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ESLint, RuleTester } from "eslint";

import plugin, {
  classifyFeatureGateImport,
  classifyFeaturesIndexReexport,
  classifyLibRegistryImport,
  classifyCronFactoryImport,
  classifyPageGuardImport,
  classifyRouteFactoryImport,
  closablePatternOf,
  isClientCodeFile,
  readClosablePatterns,
} from "./import-boundaries.mjs";
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

test("classify: lib → registry は値も型も禁止(例外の一覧は無い)", () => {
  assert.equal(classifyLibRegistryImport("src/lib/a/index.ts", "src/registry/fooRegistry"), "libRegistry");
  assert.equal(classifyLibRegistryImport("src/features/x/a.ts", "src/registry/fooRegistry"), null, "lib の外は対象外");
  assert.equal(classifyLibRegistryImport("src/lib/b/index.ts", "src/lib/domain"), null);
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

test("rule lib-no-registry: 値も型も止める", () => {
  ruleTester.run("lib-no-registry", plugin.rules["lib-no-registry"], {
    valid: [
      { code: `import { x } from "@/lib/domain";`, filename: at("src/lib/foo/index.ts") },
    ],
    invalid: [
      { code: `import { serviceRegistry } from "@/registry/serviceRegistry";`, filename: at("src/lib/foo/index.ts"), errors: [{ messageId: "libRegistry" }] },
      { code: `import type { PairedDeviceKind } from "@/registry/pairedDeviceKindRegistry";`, filename: at("src/lib/foo/index.ts"), errors: [{ messageId: "libRegistry" }] },
      { code: `import { x } from "../../registry/fooRegistry";`, filename: at("src/lib/foo/index.ts"), errors: [{ messageId: "libRegistry" }] },
      { code: `import { domainConfigMap } from "@/registry/domainConfigRegistry";`, filename: at("src/lib/domain/definition/createDomainConfigLookup.ts"), errors: [{ messageId: "libRegistry" }] },
    ],
  });
});

test("rule lib-no-features: 値も型も、別名も相対も止める。lib の外は通す", () => {
  ruleTester.run("lib-no-features", plugin.rules["lib-no-features"], {
    valid: [
      { code: `import { x } from "@/lib/domain";`, filename: at("src/lib/foo/index.ts") },
      { code: `import { x } from "@/features/core/user/types";`, filename: at("src/wiring/apiRoute.ts") },
    ],
    invalid: [
      { code: `import { x } from "@/features/core/auth/services/server/foo";`, filename: at("src/lib/foo/index.ts"), errors: [{ messageId: "libFeatures" }] },
      { code: `import type { X } from "@/features/core/user/types";`, filename: at("src/lib/foo/index.ts"), errors: [{ messageId: "libFeatures" }] },
      { code: `import { x } from "@/features/user/types";`, filename: at("src/lib/foo/index.ts"), errors: [{ messageId: "libFeatures" }] },
      { code: `import { x } from "../../features/sample/entities";`, filename: at("src/lib/foo/index.ts"), errors: [{ messageId: "libFeatures" }] },
      { code: `const m = await import("@/features/sample/entities");`, filename: at("src/lib/foo/index.ts"), errors: [{ messageId: "libFeatures" }] },
    ],
  });
});

test("isClientCodeFile: use client と場所で決め、差し替えの server の Screen・loader とテストは外す", () => {
  const client = '// コメント\n\n"use client";\n';
  assert.equal(isClientCodeFile("src/features/x/lib/a.ts", client), true);
  assert.equal(isClientCodeFile("src/app/a/_screen/AScreen.tsx", client), true);
  assert.equal(isClientCodeFile("src/features/x/components/A.tsx", ""), true);
  assert.equal(isClientCodeFile("src/features/x/hooks/useA.ts", ""), true);
  assert.equal(isClientCodeFile("src/app/a/_components/Part.tsx", ""), true);
  assert.equal(isClientCodeFile("src/features/x/components/AScreen.tsx", ""), true, "components/ に例外なし");
  assert.equal(isClientCodeFile("src/features/x/components/loader.ts", ""), true, "components/ に例外なし");
  assert.equal(isClientCodeFile("src/app/(user)/a/_components/AScreen.tsx", client), true, "use client があれば Screen でも");
  assert.equal(isClientCodeFile("src/app/a/_components/AScreen.tsx", ""), false);
  assert.equal(isClientCodeFile("src/app/admin/(protected)/users/general/_components/loader.ts", ""), false);
  assert.equal(isClientCodeFile("src/app/a/_screen/loader.ts", ""), false);
  assert.equal(isClientCodeFile("src/features/x/services/server/a.ts", ""), false);
  assert.equal(isClientCodeFile("src/components/Form/a.test.ts", ""), false);
  assert.equal(isClientCodeFile("scripts/components/a.ts", ""), false);
  assert.equal(isClientCodeFile("src/features/x/a.ts", '// "use client"\nconst a = 1;\n'), false, "コメントの中は数えない");
});

test("rule client-no-domain-json: import・型・import()・export from を止め、server は通す", () => {
  const part = at("src/features/x/components/A.tsx");
  const json = "@/features/x/domain.json";
  ruleTester.run("client-no-domain-json", plugin.rules["client-no-domain-json"], {
    valid: [
      { code: `import { domainDisplay } from "@/features/x/entities/display";`, filename: part },
      { code: `import c from "${json}";`, filename: at("src/features/x/services/server/drizzleBase.ts") },
      { code: `import c from "${json}";`, filename: at("src/app/admin/samples/new/_screen/loader.ts") },
      { code: `import c from "${json}";`, filename: at("src/app/admin/(protected)/users/general/_components/loader.ts") },
      { code: `import c from "${json}";`, filename: at("src/app/admin/x/_components/XScreen.tsx") },
      { code: `import c from "${json}";`, filename: at("src/features/x/components/A.test.ts") },
    ],
    invalid: [
      { code: `import c from "${json}";`, filename: part, errors: [{ messageId: "clientDomainJson" }] },
      { code: `import type c from "${json}";`, filename: part, errors: [{ messageId: "clientDomainJson" }] },
      { code: `import c from "../domain.json";`, filename: part, errors: [{ messageId: "clientDomainJson" }] },
      { code: `import c from "@/features/user/domain.json";`, filename: at("src/features/x/hooks/useA.ts"), errors: [{ messageId: "clientDomainJson" }] },
      { code: `const c = await import("${json}");`, filename: part, errors: [{ messageId: "clientDomainJson" }] },
      { code: `export { default } from "${json}";`, filename: part, errors: [{ messageId: "clientDomainJson" }] },
      { code: `"use client";\nimport c from "${json}";`, filename: at("src/app/a/_screen/Part.tsx"), errors: [{ messageId: "clientDomainJson" }] },
      { code: `"use client";\nimport c from "${json}";`, filename: at("src/app/a/_components/AScreen.tsx"), errors: [{ messageId: "clientDomainJson" }] },
      { code: `import c from "${json}";`, filename: at("src/app/a/_components/Part.tsx"), errors: [{ messageId: "clientDomainJson" }] },
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
  const FEAT = `import type { X } from "@/features/core/user/types";\nexport type Y = X;\n`;
  assert.deepEqual(await lintAt("src/lib/foo/index.ts", FEAT), ["import-boundaries/lib-no-features:2"]);
  assert.deepEqual(await lintAt("src/lib/foo/foo.test.mjs", FEAT), []);
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

test("classifyCronFactoryImport: cron の作り手の値 import は wiring と lib/cron の中だけ、型と他の名前は誰でも", () => {
  const route = "src/app/api/cron/x/route.ts";
  const value = (name) => [{ name, typeOnly: false }];
  assert.equal(classifyCronFactoryImport(route, "src/lib/cron", false, value("createCronTaskRoute")), "createCronTaskRoute");
  assert.equal(classifyCronFactoryImport(route, "src/lib/cron/createCronRoute.ts", false, value("createCronRoute")), "createCronRoute");
  assert.equal(classifyCronFactoryImport(route, "src/lib/cron", false, null), "*", "名前を問わない形は止める");
  assert.equal(classifyCronFactoryImport(route, "src/lib/cron", true, value("createCronTaskRoute")), null, "型だけは可");
  assert.equal(classifyCronFactoryImport("src/features/x/sweep.ts", "src/lib/cron", false, value("runBudgetedBatches")), null, "他の名前は可");
  assert.equal(classifyCronFactoryImport(route, "src/lib/cron", false, [{ name: "createCronTaskRoute", typeOnly: true }]), null);
  assert.equal(classifyCronFactoryImport("src/wiring/cronRoute.ts", "src/lib/cron", false, value("createCronTaskRoute")), null);
  assert.equal(classifyCronFactoryImport("src/lib/cron/index.ts", "src/lib/cron/createCronRoute", false, value("createCronTaskRoute")), null);
  assert.equal(classifyCronFactoryImport(route, "src/wiring/cronRoute.ts", false, value("createCronTaskRoute")), null);
  assert.equal(classifyCronFactoryImport("scripts/cron/cronWiring.test.mjs", "src/lib/cron/createCronRoute.ts", false, value("createCronRoute")), null, "テストは対象外");
});

test("rule cron-route-via-wiring: cron の route は @/wiring/cronRoute、@/lib/cron の作り手は止める", () => {
  const route = at("src/app/api/cron/x/route.ts");
  ruleTester.run("cron-route-via-wiring", plugin.rules["cron-route-via-wiring"], {
    valid: [
      { code: `import { createCronTaskRoute } from "@/wiring/cronRoute";`, filename: route },
      { code: `import type { CronTaskDefinition } from "@/lib/cron";`, filename: at("src/app/api/cron/x/task.ts") },
      { code: `import { runBudgetedBatches, createDeadline } from "@/lib/cron";`, filename: at("src/features/core/auditLog/services/server/prune.ts") },
      { code: `import { createCronTaskRoute } from "@/lib/cron";`, filename: at("src/wiring/cronRoute.ts") },
    ],
    invalid: [
      { code: `import { createCronTaskRoute } from "@/lib/cron";`, filename: route, errors: [{ messageId: "cronFactory" }] },
      { code: `import { createCronRoute } from "src/lib/cron/createCronRoute";`, filename: route, errors: [{ messageId: "cronFactory" }] },
      { code: `import * as cron from "@/lib/cron";`, filename: route, errors: [{ messageId: "cronFactory" }] },
    ],
  });
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

test("eslint.config: client-no-domain-json は src の client のコードに error で当たる", async () => {
  const code = `import c from "@/features/sample/domain.json";\nexport default c;\n`;
  assert.ok((await lintAt("src/features/sample/components/Probe.tsx", code)).includes("import-boundaries/client-no-domain-json:2"));
  assert.ok(!(await lintAt("src/features/sample/services/server/probe.ts", code)).includes("import-boundaries/client-no-domain-json:2"));
});

test("classify: 門番の外からは入口 3 つだけ、lib は読まない、node.ts は scripts とテストだけ(D7・L1.3)", () => {
  const C = classifyFeatureGateImport;
  assert.equal(C("src/proxies/featureGate.ts", "src/featureGate"), null);
  assert.equal(C("src/app/(user)/demo/_screen/loader.ts", "src/featureGate/index"), null);
  assert.equal(C("src/app/x/Client.tsx", "src/featureGate/client.ts"), null);
  assert.equal(C("scripts/registry/push.ts", "src/featureGate/node"), null);
  assert.equal(C("scripts/routes/map.mjs", "src/featureGate/node.ts"), null);
  assert.equal(C("src/featureGate/extensions/rules.ts", "src/featureGate/rules/wallet"), null, "門番の中どうしは自由");
  assert.equal(C("src/featureGate/rules/wallet.ts", "src/featureGate"), null);
  assert.equal(C("src/lib/screens/routeMap.test.mjs", "src/featureGate/node.ts"), null, "テストは対象外");
  assert.equal(C("scripts/proxies/proxyFrame.test.mjs", "src/featureGate/checks/alwaysOnEntries.mjs"), null, "テストは対象外");
  assert.equal(C("src/app/x/page.tsx", "src/lib/pathPattern/index.mjs"), null, "門番の外の import は見ない");
  assert.equal(C("src/lib/screens/routeMap.mjs", "src/featureGate/node.ts"), "gateFromLib");
  assert.equal(C("src/lib/foo/index.ts", "src/featureGate"), "gateFromLib", "lib は入口も読まない");
  assert.equal(C("src/proxies/x.ts", "src/featureGate/evaluate"), "gateInternal");
  assert.equal(C("src/app/x/page.tsx", "src/featureGate/rules/wallet"), "gateInternal");
  assert.equal(C("scripts/foo.mjs", "src/featureGate/extensions/rules.ts"), "gateInternal");
  assert.equal(C("src/app/api/x/route.ts", "src/featureGate/node"), "gateNode");
  assert.equal(C("src/proxies/x.ts", "src/featureGate/node.ts"), "gateNode");
});

test("rule feature-gate-entries: 型も別名も相対も dynamic import も止め、入口は通す", () => {
  ruleTester.run("feature-gate-entries", plugin.rules["feature-gate-entries"], {
    valid: [
      { code: `import { gate } from "@/featureGate";`, filename: at("src/proxies/featureGate.ts") },
      { code: `import type { FeatureName } from "@/featureGate";`, filename: at("src/app/x/page.tsx") },
      { code: `const m = await import("@/featureGate/node");`, filename: at("scripts/registry/push.ts") },
      { code: `import { rule } from "@/featureGate/rules/wallet";`, filename: at("src/featureGate/extensions/rules.ts") },
      { code: `import { rules } from "../../featureGate/node.ts";`, filename: at("src/lib/screens/routeMap.test.mjs") },
      { code: `import { clientGateState } from "@/featureGate";`, filename: at("src/app/layout.tsx") },
      { code: `import { GateProvider, type ClientGateState } from "@/featureGate/client";`, filename: at("src/wiring/AppProviders.tsx") },
      { code: `import { GateProvider } from "@/featureGate/client";`, filename: at("src/app/admin/(protected)/layout.tsx") },
      { code: `import { clientGateState } from "@/featureGate";`, filename: at("src/app/admin/insane/layout.tsx") },
      { code: `import { useGate, type ClientGateState } from "@/featureGate/client";`, filename: at("src/app/x/_components/Menu.tsx") },
      { code: `import { gate } from "@/featureGate";`, filename: at("src/app/x/page.tsx") },
    ],
    invalid: [
      { code: `import type { FeatureGateRule } from "@/featureGate";`, filename: at("src/lib/foo/index.ts"), errors: [{ messageId: "gateFromLib" }] },
      { code: `import { resolvePath } from "@/featureGate/evaluate";`, filename: at("src/proxies/x.ts"), errors: [{ messageId: "gateInternal" }] },
      { code: `import { rule } from "../../featureGate/rules/wallet";`, filename: at("src/app/x/page.tsx"), errors: [{ messageId: "gateInternal" }] },
      { code: `const m = await import("@/featureGate/node");`, filename: at("src/app/api/x/route.ts"), errors: [{ messageId: "gateNode" }] },
      { code: `export { rules } from "src/featureGate/node";`, filename: at("src/proxies/x.ts"), errors: [{ messageId: "gateNode" }] },
      { code: `import { clientGateState } from "@/featureGate";`, filename: at("src/app/x/_screen/loader.ts"), errors: [{ messageId: "gateWiringOnly" }] },
      { code: `import { useGate, GateProvider } from "@/featureGate/client";`, filename: at("src/app/admin/layout.tsx"), errors: [{ messageId: "gateWiringOnly" }] },
      { code: `export { GateProvider } from "@/featureGate/client";`, filename: at("src/components/x.ts"), errors: [{ messageId: "gateWiringOnly" }] },
    ],
  });
});

test("config: feature-gate-entries は src と scripts で error、テストは対象外", async () => {
  const DEEP = `import { rules } from "@/featureGate/extensions/rules";\nexport const x = rules;\n`;
  assert.deepEqual(await lintAt("src/app/api/foo/route.ts", DEEP), ["import-boundaries/feature-gate-entries:2"]);
  assert.deepEqual(await lintAt("scripts/foo/run.ts", DEEP), ["import-boundaries/feature-gate-entries:2"]);
  assert.deepEqual(await lintAt("src/lib/foo/index.ts", `import { gate } from "@/featureGate";\nexport const x = gate;\n`), ["import-boundaries/feature-gate-entries:2"]);
  assert.deepEqual(await lintAt("scripts/foo/run.test.mjs", DEEP), []);
});

test("rule link-via-shelf: 既定は棚の Link の外の next/link を全部止め、棚の Link の中と型だけの import は通す", () => {
  ruleTester.run("link-via-shelf", plugin.rules["link-via-shelf"], {
    valid: [
      { code: `import NextLink from "next/link";`, filename: at("src/components/Navigation/Link/index.tsx") },
      { code: `import type { LinkProps } from "next/link";`, filename: at("src/app/x/page.tsx") },
      { code: `import { Link } from "@/components/Navigation";`, filename: at("src/app/x/page.tsx") },
    ],
    invalid: [
      { code: `import Link from "next/link";\nconst a = "/somewhere";`, filename: at("src/app/x/page.tsx"), errors: [{ messageId: "rawNextLink" }] },
      { code: `import NextLink from "next/link";`, filename: at("src/features/core/user/components/X.tsx"), errors: [{ messageId: "rawNextLink" }] },
    ],
  });
});

test("rule link-via-shelf closableOnly(fork): 規則の住所の字面(文字列・テンプレートの頭)を持つファイルだけ止める", () => {
  const options = [{ closableOnly: true }];
  ruleTester.run("link-via-shelf", plugin.rules["link-via-shelf"], {
    valid: [
      { code: `import Link from "next/link";\nconst a = "/my-own-page";`, filename: at("src/app/x/page.tsx"), options },
      { code: `import Link from "next/link";\nconst a = "/api/wallet";`, filename: at("src/app/x/page.tsx"), options },
      { code: `import Link from "next/link";\nconst a = "https://example.com/wallet";`, filename: at("src/app/x/page.tsx"), options },
      { code: `import Link from "next/link";\nconst href = base + "/x";`, filename: at("src/app/x/page.tsx"), options },
    ],
    invalid: [
      { code: `import Link from "next/link";\nconst a = "/wallet/history?x=1";`, filename: at("src/app/x/page.tsx"), options, errors: [{ messageId: "rawNextLinkClosable" }] },
      { code: "import Link from \"next/link\";\nconst a = `/wallet/${slug}`;", filename: at("src/app/x/page.tsx"), options, errors: [{ messageId: "rawNextLinkClosable" }] },
    ],
  });
});

test("readClosablePatterns: 実リポの規則から字面のパターンを読み、/api の下は除く", () => {
  const patterns = readClosablePatterns(repoRoot);
  assert.ok(patterns.includes("/wallet"), "wallet の住所");
  assert.ok(patterns.every((p) => !/^=?\/api(\/|$)/.test(p)), "/api の下は除く");
  assert.equal(closablePatternOf("/wallet/history#a", patterns), "/wallet");
  assert.equal(closablePatternOf("//wallet", patterns), null);
});

test("config: link-via-shelf は Tier1 で error(テストは対象外)", async () => {
  const RAW = `import Link from "next/link";\nexport const x = Link;\n`;
  assert.deepEqual(await lintAt("src/app/foo/_components/Part.tsx", RAW), ["import-boundaries/link-via-shelf:2"]);
  assert.deepEqual(await lintAt("src/app/foo/_components/Part.test.tsx", RAW), []);
});

test("rule router-via-guard: next/navigation の useRouter を止め(別名・ほかの名前と一緒でも)、守りの lib の中・型だけ・ほかの名前は通す", () => {
  ruleTester.run("router-via-guard", plugin.rules["router-via-guard"], {
    valid: [
      { code: `import { useRouter, usePathname } from "next/navigation";`, filename: at("src/lib/unsavedGuard/UnsavedGuardProvider.tsx") },
      { code: `import { usePathname, useSearchParams, redirect } from "next/navigation";`, filename: at("src/app/x/page.tsx") },
      { code: `import { useRouter } from "@/lib/unsavedGuard";`, filename: at("src/features/core/user/components/X.tsx") },
      { code: `import type { useRouter } from "next/navigation";`, filename: at("src/app/x/page.tsx") },
    ],
    invalid: [
      { code: `import { useRouter } from "next/navigation";`, filename: at("src/features/core/user/components/X.tsx"), errors: [{ messageId: "rawUseRouter" }] },
      { code: `import { usePathname, useRouter as useNav } from "next/navigation";`, filename: at("src/components/AppFrames/X.tsx"), errors: [{ messageId: "rawUseRouter" }] },
      { code: `import { useRouter } from "next/navigation";`, filename: at("src/lib/crud/hooks/x.ts"), errors: [{ messageId: "rawUseRouter" }] },
    ],
  });
});
