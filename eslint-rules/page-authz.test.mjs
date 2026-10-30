// eslint-rules/page-authz.test.mjs
// ページ層の認可の置き場所の検査(M3・M4)の契約テスト。実行: pnpm test:page-authz-lint (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { ESLint, RuleTester } from "eslint";

import plugin, { classifyLayoutImport, classifySessionImport } from "./page-authz.mjs";

// `import type` を解析するため TS パーサーを使う。直接依存にはしていないので eslint-config-next 経由で解決する
const tsParser = createRequire(import.meta.resolve("eslint-config-next"))("@typescript-eslint/parser");
const repoRoot = path.resolve(import.meta.dirname, "..");

test("classifyLayoutImport: services/server・DB・loader を止め、authorization と型だけは通す", () => {
  assert.equal(classifyLayoutImport("@/features/core/user/services/server/userService"), "serverService");
  assert.equal(classifyLayoutImport("@/features/core/setting/services/server"), "serverService");
  assert.equal(classifyLayoutImport("../services/server/fooService"), "serverService");
  assert.equal(classifyLayoutImport("@/features/core/admin/services/server/loaders/adminList"), "serverService");
  assert.equal(classifyLayoutImport("@/lib/drizzle"), "db");
  assert.equal(classifyLayoutImport("@/lib/drizzle/client"), "db");
  assert.equal(classifyLayoutImport("drizzle-orm"), "db");
  assert.equal(classifyLayoutImport("@/lib/firebase/server/app"), "db");
  assert.equal(classifyLayoutImport("firebase-admin/firestore"), "db");
  assert.equal(classifyLayoutImport("./_screen/loader"), "loader");
  assert.equal(classifyLayoutImport("@/app/admin/setup/_screen/loader"), "loader");
  // 許可
  assert.equal(classifyLayoutImport("@/features/core/auth/services/server/authorization"), null);
  assert.equal(classifyLayoutImport("@/features/core/user/services/server/userService", true), null);
  assert.equal(classifyLayoutImport("@/features/core/user/constants"), null);
  assert.equal(classifyLayoutImport("@/app/admin/(protected)/_layout/AdminProtectedLayout"), null);
  assert.equal(classifyLayoutImport("@/features/core/auth/components/AuthSessionProvider"), null);
  assert.equal(classifyLayoutImport("@/lib/firebase/client/app"), null);
  assert.equal(classifyLayoutImport("./uploader"), null);
});

test("classifySessionImport: セッション API の名前と定義モジュールを止め、型だけと他の名前は通す", () => {
  const v = (name) => ({ name, typeOnly: false });
  const t = (name) => ({ name, typeOnly: true });
  const auth = "@/features/core/auth/services/server/authorization";
  assert.deepEqual(classifySessionImport(auth, [v("authGuard")]), ["authGuard"]);
  assert.deepEqual(
    classifySessionImport("@/features/core/user/services/server/userService", [v("userService"), v("requireCurrentUser")]),
    ["requireCurrentUser"],
  );
  assert.deepEqual(classifySessionImport("@/features/core/pairedDevice/services/server/session", [v("deviceGuard")]), ["deviceGuard"]);
  assert.deepEqual(classifySessionImport("@/lib/jwt", [v("parseSessionCookie")]), ["parseSessionCookie"]);
  // モジュール単位(名前を問わない形)
  assert.deepEqual(classifySessionImport(auth, null), ["*"]);
  assert.deepEqual(classifySessionImport("@/features/core/auth/services/server/session/getSessionUser", null), ["*"]);
  assert.deepEqual(classifySessionImport("@/features/core/auth/services/server/requireRole", null), ["*"]);
  assert.deepEqual(classifySessionImport("@/features/core/user/services/server/resolvers/requireCurrentUser", null), ["*"]);
  // 通すもの
  assert.deepEqual(classifySessionImport(auth, [t("authGuard")]), []);
  assert.deepEqual(classifySessionImport(auth, [v("authGuard")], true), []);
  assert.deepEqual(classifySessionImport(auth, [v("hasAdminUser")]), []);
  assert.deepEqual(classifySessionImport("@/features/core/auth/entities/session", [t("SessionUser")]), []);
  assert.deepEqual(classifySessionImport("@/features/core/auth/hooks/useAuthSession", [v("useAuthSession")]), []);
  assert.deepEqual(classifySessionImport("@/features/core/user/services/server/userService", null), []);
});

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module", parser: tsParser },
});

test("rule layout-no-server-data: 値 import・dynamic import・export from を止め、認可の関数と型 import は通す", () => {
  ruleTester.run("layout-no-server-data", plugin.rules["layout-no-server-data"], {
    valid: [
      { code: `import { authGuard, hasAdminUser } from "@/features/core/auth/services/server/authorization";` },
      { code: `import type { User } from "@/features/core/user/services/server/userService";` },
      { code: `import { type Foo } from "@/lib/drizzle";` },
      { code: `import { AuthSessionProvider } from "@/features/core/auth/components/AuthSessionProvider";` },
      { code: `import { getRolesByCategory } from "@/features/core/user/constants";` },
    ],
    invalid: [
      {
        code: `import { userService } from "@/features/core/user/services/server/userService";`,
        errors: [{ messageId: "serverService" }],
      },
      { code: `import { db } from "@/lib/drizzle";`, errors: [{ messageId: "db" }] },
      { code: `import { eq } from "drizzle-orm";`, errors: [{ messageId: "db" }] },
      { code: `import { loadAdminSetupScreen } from "./setup/_screen/loader";`, errors: [{ messageId: "loader" }] },
      { code: `const m = await import("@/features/core/setting/services/server");`, errors: [{ messageId: "serverService" }] },
      { code: `export { userService } from "@/features/core/user/services/server/userService";`, errors: [{ messageId: "serverService" }] },
    ],
  });
});

test("rule session-api-callsite: セッション API の名前・モジュールを止め、型と他の名前は通す", () => {
  ruleTester.run("session-api-callsite", plugin.rules["session-api-callsite"], {
    valid: [
      { code: `import type { SessionUser } from "@/features/core/auth/entities/session";` },
      { code: `import { type SessionDevice } from "@/features/core/pairedDevice/services/server/session";` },
      { code: `import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";` },
      { code: `import { userService } from "@/features/core/user/services/server/userService";` },
      { code: `import { hasAdminUser } from "@/features/core/auth/services/server/authorization";` },
    ],
    invalid: [
      {
        code: `import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";`,
        errors: [{ messageId: "named" }],
      },
      {
        code: `import { authGuard as guard } from "@/features/core/auth/services/server/authorization";`,
        errors: [{ messageId: "named" }],
      },
      {
        code: `import { requireCurrentUser } from "@/features/core/user/services/server/userService";`,
        errors: [{ messageId: "named" }],
      },
      {
        code: `import * as auth from "@/features/core/auth/services/server/authorization";`,
        errors: [{ messageId: "module" }],
      },
      {
        code: `const m = await import("@/features/core/auth/services/server/requireRole");`,
        errors: [{ messageId: "module" }],
      },
      {
        code: `export { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";`,
        errors: [{ messageId: "named" }],
      },
      {
        code: `import { requireAdmin } from "@/features/core/auth/services/server/requireRole";`,
        filename: "src/app/api/foo/route.ts",
        errors: [{ messageId: "namedApi" }],
      },
      {
        code: `import * as jwt from "@/lib/jwt";`,
        filename: "src/app/api/foo/_shared/helper.ts",
        errors: [{ messageId: "moduleApi" }],
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

const USER_SERVICE = `import { userService } from "@/features/core/user/services/server/userService";\nexport const x = userService;\n`;
const AUTH_GUARD = `import { authGuard } from "@/features/core/auth/services/server/authorization";\nexport const x = authGuard;\n`;
const SESSION = `import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";\nexport const x = getSessionUser;\n`;

test("config: M4 は layout と _layout/ の組み立てで error、layout の隣の guard.ts は対象外", async () => {
  assert.deepEqual(await lintAt("src/app/admin/(protected)/layout.tsx", USER_SERVICE), ["page-authz/layout-no-server-data:2"]);
  assert.deepEqual(await lintAt("src/app/(user)/_layout/UserFrame.tsx", USER_SERVICE), ["page-authz/layout-no-server-data:2"]);
  assert.deepEqual(await lintAt("src/app/(user)/guard.ts", USER_SERVICE), []);
  // layout は隣の guard.ts の guard() を 1 行で呼ぶ
  assert.deepEqual(await lintAt("src/app/admin/(protected)/layout.tsx", `import { guard } from "./guard";\nexport const x = guard;\n`), []);
  assert.deepEqual(await lintAt("src/app/foo/_screen/loader.ts", USER_SERVICE), []);
});

test("config: M3 は page・Screen・部品・hooks・API(route と補助ファイル)で error、layout・_layout・loader・AuthSessionProvider は許可", async () => {
  const err = ["page-authz/session-api-callsite:2"];
  assert.deepEqual(await lintAt("src/app/debug/playtest/page.tsx", SESSION), err);
  assert.deepEqual(await lintAt("src/app/foo/_screen/FooScreen.tsx", SESSION), err);
  assert.deepEqual(await lintAt("src/app/foo/_components/FooScreen.tsx", SESSION), err);
  assert.deepEqual(await lintAt("src/components/Foo/Foo.tsx", SESSION), err);
  assert.deepEqual(await lintAt("src/features/sample/components/Foo/index.tsx", SESSION), err);
  assert.deepEqual(await lintAt("src/features/sample/hooks/useFoo.ts", SESSION), err);
  assert.deepEqual(await lintAt("src/hooks/useFoo.ts", SESSION), err);
  // 許可
  // layout は authorization の関数(authGuard)だけ。session/getSessionUser の直読みは M4 が止める(任意のセッション読み取りの範囲は loader Factory と一緒に決める)
  assert.deepEqual(await lintAt("src/app/foo/layout.tsx", AUTH_GUARD), []);
  assert.deepEqual(await lintAt("src/app/foo/layout.tsx", SESSION), ["page-authz/layout-no-server-data:2"]);
  // guard.ts はセッション API を import しない(root は @/wiring/pageGuard、子は親の extend で作る)
  assert.deepEqual(await lintAt("src/app/foo/guard.ts", SESSION), err);
  assert.deepEqual(await lintAt("src/app/foo/_screen/loader.ts", SESSION), []);
  assert.deepEqual(await lintAt("src/app/foo/_components/loader.ts", SESSION), []);
  // API: 主体は Factory の ctx.user。token だけのセッション・Cookie の解析も止める(D8 K4)
  assert.deepEqual(await lintAt("src/app/api/foo/route.ts", SESSION), err);
  assert.deepEqual(await lintAt("src/app/api/foo/_shared/helper.ts", SESSION), err);
  assert.deepEqual(
    await lintAt("src/app/api/foo/route.ts", `import { getTokenOnlySession } from "@/features/core/auth/services/server/session/getTokenOnlySession";\nexport const x = getTokenOnlySession;\n`),
    err,
  );
  assert.deepEqual(await lintAt("src/app/api/foo/route.ts", `import { parseSessionCookie } from "@/lib/jwt";\nexport const x = parseSessionCookie;\n`), err);
  assert.deepEqual(
    await lintAt("src/app/api/foo/route.ts", `import { clearSessionCookie } from "@/features/core/auth/services/server/session/clearSessionCookie";\nexport const x = clearSessionCookie;\n`),
    [],
    "Cookie の消去・発行はセッションの取得ではないので通す",
  );
  assert.deepEqual(await lintAt("src/features/core/auth/components/AuthSessionProvider.tsx", SESSION), []);
  assert.deepEqual(await lintAt("src/features/sample/services/server/fooService.ts", SESSION), []);
});
