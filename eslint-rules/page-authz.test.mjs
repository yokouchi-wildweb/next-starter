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

test("classifyLayoutImport: services/server・DB(entities/drizzle を含む)を止め、layout だけ loader も止める。型だけは通す", () => {
  assert.equal(classifyLayoutImport("@/features/core/user/services/server/userService"), "serverService");
  assert.equal(classifyLayoutImport("@/features/core/setting/services/server"), "serverService");
  assert.equal(classifyLayoutImport("../services/server/fooService"), "serverService");
  assert.equal(classifyLayoutImport("@/features/core/admin/services/server/screenData/adminList"), "serverService");
  assert.equal(classifyLayoutImport("@/lib/drizzle"), "db");
  assert.equal(classifyLayoutImport("@/lib/drizzle/client"), "db");
  assert.equal(classifyLayoutImport("drizzle-orm"), "db");
  assert.equal(classifyLayoutImport("@/lib/firebase/server/app"), "db");
  assert.equal(classifyLayoutImport("firebase-admin/firestore"), "db");
  assert.equal(classifyLayoutImport("./_screen/loader"), "loader");
  assert.equal(classifyLayoutImport("@/app/admin/setup/_screen/loader"), "loader");
  assert.equal(classifyLayoutImport("@/features/core/user/entities/drizzle"), "db");
  // authorization の例外は撤去(layout のセッション参照は隣の guard.ts の guard() だけ)
  assert.equal(classifyLayoutImport("@/features/core/auth/services/server/authorization"), "serverService");
  // Screen(layout 以外)は同じルートの loader を呼ぶ
  assert.equal(classifyLayoutImport("./loader", false, { layout: false }), null);
  // 許可
  assert.equal(classifyLayoutImport("@/features/core/user/entities/drizzle", true), null);
  assert.equal(classifyLayoutImport("@/features/core/user/entities/model"), null);
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
  assert.deepEqual(classifySessionImport(auth, [v("hasUserForAccess")]), []);
  assert.deepEqual(classifySessionImport("@/features/core/auth/entities/session", [t("SessionUser")]), []);
  assert.deepEqual(classifySessionImport("@/features/core/auth/hooks/useAuthSession", [v("useAuthSession")]), []);
  assert.deepEqual(classifySessionImport("@/features/core/user/services/server/userService", null), []);
});

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module", parser: tsParser },
});

test("rule layout-no-server-data: 値 import・dynamic import・export from を止め、型 import は通す(layout だけ loader も止める)", () => {
  ruleTester.run("layout-no-server-data", plugin.rules["layout-no-server-data"], {
    valid: [
      { code: `import { loadXScreen } from "./loader";`, filename: "src/app/x/_screen/XScreen.tsx" },
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
      { code: `import { loadAdminSetupScreen } from "./setup/_screen/loader";`, filename: "src/app/admin/layout.tsx", errors: [{ messageId: "loader" }] },
      { code: `import { guard } from "./guard";\nimport { authGuard } from "@/features/core/auth/services/server/authorization";`, filename: "src/app/admin/layout.tsx", errors: [{ messageId: "serverService" }] },
      { code: `import { UserTable } from "@/features/core/user/entities/drizzle";`, filename: "src/components/Foo.tsx", errors: [{ messageId: "db" }] },
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
      { code: `import { hasUserForAccess } from "@/features/core/auth/services/server/authorization";` },
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
    "src/features/sample/components/Foo/index.tsx",
    "src/features/sample/hooks/useFoo.ts",
  ]) {
    assert.deepEqual(await lintAt(file, USER_SERVICE), err, file);
  }
  // DB(L1.20): entities/drizzle の表の値 import も UI では不可、型は可
  assert.deepEqual(await lintAt("src/app/foo/_screen/FooScreen.tsx", `import { UserTable } from "@/features/core/user/entities/drizzle";\nexport const x = UserTable;\n`), err);
  assert.deepEqual(await lintAt("src/app/foo/_screen/FooScreen.tsx", `import type { UserTable } from "@/features/core/user/entities/drizzle";\nexport type X = typeof UserTable;\n`), []);
  // layout は隣の guard.ts の guard() を 1 行で呼ぶ
  assert.deepEqual(await lintAt("src/app/admin/(protected)/layout.tsx", `import { guard } from "./guard";\nexport const x = guard;\n`), []);
  // 読んでよい場所
  for (const file of ["src/app/foo/_screen/loader.ts", "src/app/foo/route.ts", "src/app/api/foo/_shared/helper.ts", "src/features/core/auth/components/AuthSessionProvider.tsx"]) {
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
    "src/features/sample/components/Foo/index.tsx",
    "src/features/sample/hooks/useFoo.ts",
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
