// eslint-rules/core-ui-guards.test.mjs
// core の部品で useForm と守りの処理を直接持たない規則の契約テスト + 許可一覧の照合。実行: pnpm test:core-ui-guards (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Linter, RuleTester } from "eslint";

import plugin from "./core-ui-guards.mjs";
import { CORE_UI_GUARDS_ALLOW } from "./core-ui-guards.allow.mjs";

const tsParser = createRequire(import.meta.resolve("eslint-config-next"))("@typescript-eslint/parser");
const root = process.cwd();
const at = (rel) => `${root}/${rel}`;
const PART = at("src/features/core/auth/components/X/index.tsx");

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parser: tsParser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

tester.run("core-ui-guards/no-guard-in-part", plugin.rules["no-guard-in-part"], {
  valid: [
    // 公開 hook を呼ぶだけ
    { filename: PART, code: 'import { useEmailRegistrationForm } from "@/features/core/auth/hooks/useEmailRegistrationForm";' },
    // 表示部品・型だけの import は対象外
    { filename: PART, code: 'import { RecaptchaBadge, RecaptchaV2Challenge } from "@/lib/recaptcha";' },
    { filename: PART, code: 'import type { UseFormReturn } from "react-hook-form";' },
    { filename: PART, code: 'import { type useForm, useWatch } from "react-hook-form";' },
    // useAuthSession から user だけ
    { filename: PART, code: "const { user } = useAuthSession();" },
    // セッションの持ち主が refreshSession を定義するのは取り出しではない
    { filename: PART, code: "const refreshSession = useCallback(async () => {}, []);" },
    // 許可一覧のファイル
    {
      filename: at("src/features/core/user/components/EditProfile.tsx"),
      code: 'import { useForm } from "react-hook-form";',
      options: [{ allow: ["src/features/core/user/components/EditProfile.tsx"] }],
    },
  ],
  invalid: [
    { filename: PART, code: 'import { useForm } from "react-hook-form";', errors: [{ messageId: "guarded" }] },
    {
      filename: PART,
      code: 'import { useRecaptcha, getRecaptchaToken, useRecaptchaV2Challenge } from "@/lib/recaptcha";',
      errors: [{ messageId: "guarded" }, { messageId: "guarded" }, { messageId: "guarded" }],
    },
    // lib の中のファイルを直に読んでも同じ
    { filename: PART, code: 'import { useRecaptcha } from "@/lib/recaptcha/hooks/useRecaptcha";', errors: [{ messageId: "guarded" }] },
    { filename: PART, code: 'import { useGuardedNavigation } from "@/lib/transitionGuard";', errors: [{ messageId: "guarded" }] },
    { filename: PART, code: "async function f(u) { return u.getIdToken(); }", errors: [{ messageId: "guarded" }] },
    { filename: PART, code: "const { user, refreshSession } = useAuthSession();", errors: [{ messageId: "guarded" }] },
    { filename: PART, code: "const r = useAuthSession().refreshSession;", errors: [{ messageId: "guarded" }] },
    // 許可一覧は別ファイルには効かない
    {
      filename: PART,
      code: 'import { useForm } from "react-hook-form";',
      options: [{ allow: ["src/features/core/user/components/EditProfile.tsx"] }],
      errors: [{ messageId: "guarded" }],
    },
  ],
});

test("許可一覧: 各行が core の部品で、今も規則に当たる(当たらない行 = hook 化済み → 一覧から消す)", () => {
  const linter = new Linter({ configType: "flat" });
  const config = [
    {
      files: ["**/*.tsx"],
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        parser: tsParser,
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
      plugins: { "core-ui-guards": plugin },
      rules: { "core-ui-guards/no-guard-in-part": "error" },
    },
  ];
  const stale = [];
  for (const rel of CORE_UI_GUARDS_ALLOW) {
    assert.match(rel, /^src\/features\/core\/[^/]+\/components\/.+\.tsx$/, `core の部品ではない: ${rel}`);
    const code = readFileSync(at(rel), "utf8");
    const messages = linter.verify(code, config, { filename: at(rel) });
    const fatal = messages.filter((m) => m.fatal);
    assert.deepEqual(fatal, [], `解析できない: ${rel}`);
    if (!messages.some((m) => m.ruleId === "core-ui-guards/no-guard-in-part")) stale.push(rel);
  }
  assert.deepEqual(stale, [], "hook 化済みの行が許可一覧に残っています。eslint-rules/core-ui-guards.allow.mjs から消してください");
  assert.equal(new Set(CORE_UI_GUARDS_ALLOW).size, CORE_UI_GUARDS_ALLOW.length, "許可一覧に重複");
});

test("01〜03 で hook 化した部品は許可一覧に無い", () => {
  for (const rel of [
    "src/features/core/auth/components/Registration/Email/index.tsx",
    "src/features/core/auth/components/Registration/OAuth/index.tsx",
    "src/features/core/auth/components/Signup/EmailVarification/sendForm.tsx",
    "src/features/core/auth/components/Signup/EarlyRegistration/SendForm.tsx",
    "src/features/core/auth/components/OAuth/index.tsx",
  ]) {
    assert.ok(!CORE_UI_GUARDS_ALLOW.includes(rel), rel);
  }
});
