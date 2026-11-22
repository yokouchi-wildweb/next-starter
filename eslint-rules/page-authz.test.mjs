// eslint-rules/page-authz.test.mjs
// ページ層の認可の置き場所の検査(M3・M4)の契約テスト。実行: pnpm test eslint-rules/page-authz.test.mjs (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { ESLint, RuleTester } from "eslint";

import plugin, { classifyLayoutImport, classifySessionImport } from "./page-authz.mjs";

// `import type` を解析するため TS パーサーを使う。直接依存にはしていないので eslint-config-next 経由で解決する
const tsParser = createRequire(import.meta.resolve("eslint-config-next"))("@typescript-eslint/parser");
const repoRoot = path.resolve(import.meta.dirname, "..");

test("classifyLayoutImport: services/server・DB(entities/drizzle を含む)を止め、layout だけ loader も止める。型だけは通す", () => {
  assert.equal(classifyLayoutImport("@/domains/core/user/services/server/userService"), "serverService");
  assert.equal(classifyLayoutImport("@/domains/core/setting/services/server"), "serverService");
  assert.equal(classifyLayoutImport("../services/server/fooService"), "serverService");
  assert.equal(classifyLayoutImport("@/domains/core/admin/services/server/screenData/adminList"), "serverService");
  assert.equal(classifyLayoutImport("@/lib/drizzle"), "db");
  assert.equal(classifyLayoutImport("@/lib/drizzle/client"), "db");
  assert.equal(classifyLayoutImport("drizzle-orm"), "db");
  assert.equal(classifyLayoutImport("@/lib/firebase/server"), "db");
  assert.equal(classifyLayoutImport("firebase-admin/firestore"), "db");
  assert.equal(classifyLayoutImport("./_screen/loader"), "loader");
  assert.equal(classifyLayoutImport("@/app/admin/setup/_screen/loader"), "loader");
  assert.equal(classifyLayoutImport("@/domains/core/user/entities/drizzle"), "db");
  // authorization の例外は撤去(layout のセッション参照は隣の guard.ts の guard() だけ)
  assert.equal(classifyLayoutImport("@/domains/core/auth/services/server/authorization"), "serverService");
  // Screen(layout 以外)は同じルートの loader を呼ぶ
  assert.equal(classifyLayoutImport("./loader", false, { layout: false }), null);
  // 許可
  assert.equal(classifyLayoutImport("@/domains/core/user/entities/drizzle", true), null);
  assert.equal(classifyLayoutImport("@/domains/core/user/entities/model"), null);
  assert.equal(classifyLayoutImport("@/domains/core/user/services/server/userService", true), null);
  assert.equal(classifyLayoutImport("@/domains/core/user/constants"), null);
  assert.equal(classifyLayoutImport("@/app/admin/(protected)/_layout/AdminProtectedLayout"), null);
  assert.equal(classifyLayoutImport("@/domains/core/auth/components/AuthSessionProvider"), null);
  assert.equal(classifyLayoutImport("@/lib/firebase/client"), null);
  assert.equal(classifyLayoutImport("./uploader"), null);
});

test("classifySessionImport: セッション API の名前と定義モジュールを止め、型だけと他の名前は通す", () => {
  const v = (name) => ({ name, typeOnly: false });
  const t = (name) => ({ name, typeOnly: true });
  const auth = "@/domains/core/auth/services/server/authorization";
  assert.deepEqual(classifySessionImport(auth, [v("authGuard")]), ["authGuard"]);
  assert.deepEqual(
    classifySessionImport("@/domains/core/user/services/server/userService", [v("userService"), v("requireCurrentUser")]),
    ["requireCurrentUser"],
  );
  assert.deepEqual(classifySessionImport("@/domains/core/pairedDevice/services/server/session", [v("deviceGuard")]), ["deviceGuard"]);
  assert.deepEqual(classifySessionImport("@/lib/jwt", [v("parseSessionCookie")]), ["parseSessionCookie"]);
  // モジュール単位(名前を問わない形)
  assert.deepEqual(classifySessionImport(auth, null), ["*"]);
  assert.deepEqual(classifySessionImport("@/domains/core/auth/services/server/session/getSessionUser", null), ["*"]);
  assert.deepEqual(classifySessionImport("@/domains/core/auth/services/server/requireRole", null), ["*"]);
  assert.deepEqual(classifySessionImport("@/domains/core/user/services/server/resolvers/requireCurrentUser", null), ["*"]);
  // 通すもの
  assert.deepEqual(classifySessionImport(auth, [t("authGuard")]), []);
  assert.deepEqual(classifySessionImport(auth, [v("authGuard")], true), []);
  assert.deepEqual(classifySessionImport(auth, [v("hasUserForAccess")]), []);
  assert.deepEqual(classifySessionImport("@/domains/core/auth/entities/session", [t("SessionUser")]), []);
  assert.deepEqual(classifySessionImport("@/domains/core/auth/hooks/useAuthSession", [v("useAuthSession")]), []);
  assert.deepEqual(classifySessionImport("@/domains/core/user/services/server/userService", null), []);
});

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module", parser: tsParser },
});

test("rule layout-no-server-data: 値 import・dynamic import・export from を止め、型 import は通す(layout だけ loader も止める)", () => {
  ruleTester.run("layout-no-server-data", plugin.rules["layout-no-server-data"], {
    valid: [
      { code: `import { loadXScreen } from "./loader";`, filename: "src/app/x/_screen/XScreen.tsx" },
      { code: `import type { User } from "@/domains/core/user/services/server/userService";` },
      { code: `import { type Foo } from "@/lib/drizzle";` },
      { code: `import { AuthSessionProvider } from "@/domains/core/auth/components/AuthSessionProvider";` },
      { code: `import { getRolesByCategory } from "@/domains/core/user/constants";` },
    ],
    invalid: [
      {
        code: `import { userService } from "@/domains/core/user/services/server/userService";`,
        errors: [{ messageId: "serverService" }],
      },
      { code: `import { db } from "@/lib/drizzle";`, errors: [{ messageId: "db" }] },
      { code: `import { eq } from "drizzle-orm";`, errors: [{ messageId: "db" }] },
      { code: `import { loadAdminSetupScreen } from "./setup/_screen/loader";`, filename: "src/app/admin/layout.tsx", errors: [{ messageId: "loader" }] },
      { code: `import { guard } from "./guard";\nimport { authGuard } from "@/domains/core/auth/services/server/authorization";`, filename: "src/app/admin/layout.tsx", errors: [{ messageId: "serverService" }] },
      { code: `import { UserTable } from "@/domains/core/user/entities/drizzle";`, filename: "src/components/Foo.tsx", errors: [{ messageId: "db" }] },
      { code: `const m = await import("@/domains/core/setting/services/server");`, errors: [{ messageId: "serverService" }] },
      { code: `export { userService } from "@/domains/core/user/services/server/userService";`, errors: [{ messageId: "serverService" }] },
    ],
  });
});

test("rule session-api-callsite: セッション API の名前・モジュールを止め、型と他の名前は通す", () => {
  ruleTester.run("session-api-callsite", plugin.rules["session-api-callsite"], {
    valid: [
      { code: `import type { SessionUser } from "@/domains/core/auth/entities/session";` },
      { code: `import { type SessionDevice } from "@/domains/core/pairedDevice/services/server/session";` },
      { code: `import { useAuthSession } from "@/domains/core/auth/hooks/useAuthSession";` },
      { code: `import { userService } from "@/domains/core/user/services/server/userService";` },
      { code: `import { hasUserForAccess } from "@/domains/core/auth/services/server/authorization";` },
    ],
    invalid: [
      {
        code: `import { getSessionUser } from "@/domains/core/auth/services/server/session/getSessionUser";`,
        errors: [{ messageId: "named" }],
      },
      {
        code: `import { authGuard as guard } from "@/domains/core/auth/services/server/authorization";`,
        errors: [{ messageId: "named" }],
      },
      {
        code: `import { requireCurrentUser } from "@/domains/core/user/services/server/userService";`,
        errors: [{ messageId: "named" }],
      },
      {
        code: `import * as auth from "@/domains/core/auth/services/server/authorization";`,
        errors: [{ messageId: "module" }],
      },
      {
        code: `const m = await import("@/domains/core/auth/services/server/requireRole");`,
        errors: [{ messageId: "module" }],
      },
      {
        code: `export { getSessionUser } from "@/domains/core/auth/services/server/session/getSessionUser";`,
        errors: [{ messageId: "named" }],
      },
      {
        code: `import { requireAdmin } from "@/domains/core/auth/services/server/requireRole";`,
        filename: "src/app/api/foo/route.ts",
        errors: [{ messageId: "namedApi" }],
      },
      {
        code: `import * as jwt from "@/lib/jwt";`,
        filename: "src/app/api/foo/_shared/helper.ts",
        errors: [{ messageId: "moduleApi" }],
      },
      // proxy の項目(D10): 主体は ctx.user()。セッション解決・Cookie の解析・解決器の直呼びを止める
      {
        code: `import { resolveSessionUser } from "@/domains/core/auth/services/server/session/token";`,
        filename: "src/proxies/foo.myfork.ts",
        errors: [{ messageId: "namedProxy" }],
      },
      {
        code: `import { parseSessionCookie } from "@/lib/jwt";`,
        filename: "src/proxies/maintenance.ts",
        errors: [{ messageId: "namedProxy" }],
      },
      {
        code: `import { createProxyUser } from "@/domains/core/auth/plugs/proxyUser/session.default";`,
        filename: "src/proxies/foo.ts",
        errors: [{ messageId: "namedProxy" }],
      },
      // 項目はドメインの plugs の点の下(D30、注文 31)でも同じ
      {
        code: `import { getSessionUser } from "@/domains/core/auth/services/server/session/getSessionUser";`,
        filename: "src/domains/core/setting/plugs/proxyHandlers/maintenance.ts",
        errors: [{ messageId: "namedProxy" }],
      },
      {
        code: `const m = await import("@/domains/core/auth/services/server/session/token");`,
        filename: "src/proxies/foo.ts",
        errors: [{ messageId: "moduleProxy" }],
      },
    ],
  });
});

// eslint.config.mjs の files / ignores の当て方(置き場所の許可)を実ファイルパスで確かめる
const lintAt = async (filePath, code) => {
  const eslint = new ESLint({ cwd: repoRoot, overrideConfigFile: path.join(repoRoot, "eslint.config.mjs") });
  const [result] = await eslint.lintText(code, { filePath: path.join(repoRoot, filePath) });
  return result.messages.filter((m) => m.ruleId?.startsWith("page-authz/")).map((m) => `${m.ruleId}:${m.severity}`);
};

const USER_SERVICE = `import { userService } from "@/domains/core/user/services/server/userService";\nexport const x = userService;\n`;
const AUTH_GUARD = `import { authGuard } from "@/domains/core/auth/services/server/authorization";\nexport const x = authGuard;\n`;
const SESSION = `import { getSessionUser } from "@/domains/core/auth/services/server/session/getSessionUser";\nexport const x = getSessionUser;\n`;

test("config: M4 は UI の場所全体(Screen・page・layout・_layout・guard.ts・_components・components・hooks)で error、loader・route・API・AuthSessionProvider は対象外", async () => {
  const err = ["page-authz/layout-no-server-data:2"];
  for (const file of [
    "src/app/admin/(protected)/layout.tsx",
    "src/app/(user)/_layout/UserFrame.tsx",
    "src/app/(user)/guard.ts",
    "src/app/foo/page.tsx",
    "src/app/foo/_screen/FooScreen.tsx",
    "src/app/foo/_components/Part.tsx",
    "src/components/Foo/Foo.tsx",
    "src/hooks/useFoo.ts",
    "src/domains/sample/components/Foo/index.tsx",
    "src/domains/sample/hooks/useFoo.ts",
  ]) {
    assert.deepEqual(await lintAt(file, USER_SERVICE), err, file);
  }
  // DB(L1.20): entities/drizzle の表の値 import も UI では不可、型は可
  assert.deepEqual(await lintAt("src/app/foo/_screen/FooScreen.tsx", `import { UserTable } from "@/domains/core/user/entities/drizzle";\nexport const x = UserTable;\n`), err);
  assert.deepEqual(await lintAt("src/app/foo/_screen/FooScreen.tsx", `import type { UserTable } from "@/domains/core/user/entities/drizzle";\nexport type X = typeof UserTable;\n`), []);
  // layout は隣の guard.ts の guard() を 1 行で呼ぶ
  assert.deepEqual(await lintAt("src/app/admin/(protected)/layout.tsx", `import { guard } from "./guard";\nexport const x = guard;\n`), []);
  // 読んでよい場所
  for (const file of ["src/app/foo/_screen/loader.ts", "src/app/foo/route.ts", "src/app/api/foo/_shared/helper.ts", "src/domains/core/auth/components/AuthSessionProvider.tsx"]) {
    assert.deepEqual(await lintAt(file, USER_SERVICE), [], file);
  }
  // サーバーのコードの hooks/ フォルダは UI の hooks ではない(domains/**/hooks の glob が services/server/**/hooks にも当たっていた)
  for (const file of [
    "src/domains/sample/services/server/draw/hooks/drawHooks.ts",
    "src/domains/core/purchaseRequest/services/server/hooks/purchaseCompleteHookRegistry.ts",
  ]) {
    assert.deepEqual(await lintAt(file, USER_SERVICE), [], file);
  }
});

test("config: M3 は src/app 全体(layout・_layout・loader・guard.ts・API を含む)と UI で error、AuthSessionProvider だけ許可", async () => {
  const err = ["page-authz/session-api-callsite:2"];
  for (const file of [
    "src/app/debug/playtest/page.tsx",
    "src/app/foo/_screen/FooScreen.tsx",
    "src/app/foo/_components/FooScreen.tsx",
    "src/components/Foo/Foo.tsx",
    "src/domains/sample/components/Foo/index.tsx",
    "src/domains/sample/hooks/useFoo.ts",
    "src/hooks/useFoo.ts",
    "src/app/foo/guard.ts",
    "src/app/foo/_screen/loader.ts",
    "src/app/foo/_components/loader.ts",
    "src/app/api/foo/route.ts",
    "src/app/api/foo/_shared/helper.ts",
  ]) {
    // UI の場所では M4(services/server の値 import)も同時に出る。M3 が出ることだけを見る
    assert.ok((await lintAt(file, SESSION)).includes(err[0]), file);
  }
  // layout・_layout の許可は撤去(layout は M4 も掛かる)
  assert.ok((await lintAt("src/app/foo/layout.tsx", AUTH_GUARD)).includes("page-authz/session-api-callsite:2"));
  assert.ok((await lintAt("src/app/foo/_layout/Frame.tsx", SESSION)).includes("page-authz/session-api-callsite:2"));
  // API: token だけのセッション・Cookie の解析も止める(D8 K4)
  assert.deepEqual(
    await lintAt("src/app/api/foo/route.ts", `import { getTokenOnlySession } from "@/domains/core/auth/services/server/session/getTokenOnlySession";\nexport const x = getTokenOnlySession;\n`),
    err,
  );
  assert.deepEqual(await lintAt("src/app/api/foo/route.ts", `import { parseSessionCookie } from "@/lib/jwt";\nexport const x = parseSessionCookie;\n`), err);
  assert.deepEqual(
    await lintAt("src/app/api/foo/route.ts", `import { clearSessionCookie } from "@/domains/core/auth/services/server/session/clearSessionCookie";\nexport const x = clearSessionCookie;\n`),
    [],
    "Cookie の消去・発行はセッションの取得ではないので通す",
  );
  assert.deepEqual(await lintAt("src/domains/core/auth/components/AuthSessionProvider.tsx", SESSION), []);
  assert.deepEqual(await lintAt("src/domains/sample/services/server/fooService.ts", SESSION), []);
  // services/server/**/hooks: core は core のサービスとして M3 が掛かり続け、fork は他の fork のサービスと同じく対象外
  assert.deepEqual(await lintAt("src/domains/core/purchaseRequest/services/server/hooks/purchaseCompleteHookRegistry.ts", SESSION), err);
  assert.deepEqual(await lintAt("src/domains/core/auth/services/server/hooks/foo.ts", SESSION), [], "主体を解く基盤(auth)は従来どおり外す");
  assert.deepEqual(await lintAt("src/domains/sample/services/server/draw/hooks/drawHooks.ts", SESSION), []);
});

test("config: M3 は proxy の骨組み(src/proxies/**)・項目(<ドメイン>/plugs/proxyHandlers・proxyDecorators・proxyRedirects)と門番(src/featureGate/**)で error、解決器を作る src/proxy.ts と項目 plugs/proxyUser は対象外", async () => {
  const err = ["page-authz/session-api-callsite:2"];
  for (const file of ["src/proxies/redirect.ts", "src/proxies/playThrottle.myfork.ts", "src/domains/core/setting/plugs/proxyHandlers/maintenance.ts", "src/domains/shop/plugs/proxyDecorators/visit.ts", "src/domains/shop/plugs/proxyRedirects/old.ts", "src/featureGate/rules/foo.ts", "src/featureGate/tools/server/x.ts"]) {
    assert.deepEqual(await lintAt(file, SESSION), err, file);
    assert.deepEqual(await lintAt(file, `import { parseSessionCookie } from "@/lib/jwt";\nexport const x = parseSessionCookie;\n`), err, file);
  }
  // 型だけ・ctx を受けるだけの項目は通す
  assert.deepEqual(
    await lintAt("src/proxies/foo.myfork.ts", `import type { SessionUser } from "@/domains/core/auth/entities/session";\nexport type X = SessionUser;\n`),
    [],
  );
  assert.deepEqual(
    await lintAt("src/proxy.ts", `import { createProxyUser } from "@/domains/core/auth/plugs/proxyUser/session.default";\nexport const x = createProxyUser;\n`),
    [],
  );
  assert.deepEqual(
    await lintAt("src/domains/core/auth/plugs/proxyUser/session.default.ts", `import { resolveSessionUser } from "../../services/server/session/token";\nexport const x = resolveSessionUser;\n`),
    [],
    "解決器そのもの(点 proxyUser の項目)は対象外",
  );
});
