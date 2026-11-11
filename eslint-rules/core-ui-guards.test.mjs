// eslint-rules/core-ui-guards.test.mjs
// core の部品・既定 Screen の部品で useForm と守りの処理を直接持たない規則の契約テスト + 許可一覧の照合。実行: pnpm test eslint-rules/core-ui-guards.test.mjs (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Linter, RuleTester } from "eslint";

import plugin, { barrelClientNames } from "./core-ui-guards.mjs";
import { CORE_UI_GUARDS_ALLOW } from "./core-ui-guards.allow.mjs";

const tsParser = createRequire(import.meta.resolve("eslint-config-next"))("@typescript-eslint/parser");
const root = process.cwd();
const at = (rel) => `${root}/${rel}`;
const PART = at("src/features/core/auth/components/X/index.tsx");
const SCREEN_PART = at("src/app/(user)/(auth)/x/_screen/XSection.tsx");

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
    // 既定 Screen の部品も公開 hook を呼ぶだけなら当たらない
    { filename: SCREEN_PART, code: 'import { useSignupComplete } from "@/features/core/auth/hooks/useSignupComplete";' },
    // 遷移の守り・計測の lib から型・他の名前だけを読むのは対象外
    { filename: PART, code: 'import { issueToken, type UseTransitionGuardResult } from "@/lib/transitionGuard";' },
    { filename: PART, code: 'import { GoogleTag } from "@/lib/googleTag";' },
    // 表示部品・型だけの import は対象外
    { filename: PART, code: 'import { RecaptchaBadge, RecaptchaV2Challenge } from "@/lib/recaptcha";' },
    { filename: PART, code: 'import type { UseFormReturn } from "react-hook-form";' },
    { filename: PART, code: 'import { type useForm, useWatch } from "react-hook-form";' },
    // useAuthSession から user だけ
    { filename: PART, code: "const { user } = useAuthSession();" },
    // セッションの持ち主が refreshSession を定義するのは取り出しではない
    { filename: PART, code: "const refreshSession = useCallback(async () => {}, []);" },
    // SWR の部品(SWRConfig)・型だけは当たらない
    { filename: PART, code: 'import { SWRConfig } from "swr";' },
    { filename: PART, code: 'import type { SWRResponse } from "swr";' },
    // ドメインのまとめから表示整形・定数・型を読むのは当たらない(services/client から再 export していない名前)
    {
      filename: SCREEN_PART,
      code: 'import { formatJpyAmount, STATUS_SLUG_BY_VALUE, type AdminBankTransferReviewListItem } from "@/features/core/bankTransferReview";',
    },
    // まとめが services/client から再 export する名前でも型だけなら当たらない
    { filename: PART, code: 'import { type AdminBankTransferReviewListResponse } from "@/features/core/bankTransferReview";' },
    { filename: PART, code: 'import type { ReferralByInviterItem } from "@/features/core/referral/services/client/referralsByInviter";' },
    // 公開 hook は当たらない
    { filename: SCREEN_PART, code: 'import { useAdminBankTransferReviewList } from "@/features/core/bankTransferReview/hooks/useAdminBankTransferReviewList";' },
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
    { filename: PART, code: 'import { useTransitionGuard } from "@/lib/transitionGuard";', errors: [{ messageId: "guarded" }] },
    { filename: PART, code: 'import { useGoogleAdsConversion } from "@/lib/googleTag";', errors: [{ messageId: "guarded" }] },
    { filename: PART, code: 'import { useGoogleAdsConversion } from "@/lib/googleTag/useGoogleAdsConversion";', errors: [{ messageId: "guarded" }] },
    // 既定 Screen の部品にも同じ規則
    { filename: SCREEN_PART, code: 'import { useTransitionGuard } from "@/lib/transitionGuard";', errors: [{ messageId: "guarded" }] },
    { filename: SCREEN_PART, code: 'import { useForm } from "react-hook-form";', errors: [{ messageId: "guarded" }] },
    { filename: PART, code: "async function f(u) { return u.getIdToken(); }", errors: [{ messageId: "guarded" }] },
    { filename: PART, code: "const { user, refreshSession } = useAuthSession();", errors: [{ messageId: "guarded" }] },
    { filename: PART, code: "const r = useAuthSession().refreshSession;", errors: [{ messageId: "guarded" }] },
    // SWR の取得・送信の hook(default・named)
    { filename: PART, code: 'import useSWR from "swr";', errors: [{ messageId: "guarded" }] },
    { filename: SCREEN_PART, code: 'import useSWR, { useSWRConfig } from "swr";', errors: [{ messageId: "guarded" }] },
    { filename: PART, code: 'import { useSWR } from "swr";', errors: [{ messageId: "guarded" }] },
    { filename: PART, code: 'import useSWRMutation from "swr/mutation";', errors: [{ messageId: "guarded" }] },
    { filename: PART, code: 'import useSWRInfinite from "swr/infinite";', errors: [{ messageId: "guarded" }] },
    // client 関数: services/client のパス(絶対・相対)・まとめの *Client
    { filename: PART, code: 'import { fetchSession } from "@/features/core/auth/services/client/session";', errors: [{ messageId: "guarded" }] },
    { filename: PART, code: 'import { fetchSession } from "../../services/client/session";', errors: [{ messageId: "guarded" }] },
    { filename: PART, code: 'import { auditLogClient } from "@/features/core/auditLog";', errors: [{ messageId: "guarded" }] },
    // まとめが services/client から再 export する名前(*Client でなくても当たる。名前ごとに 1 件)
    {
      filename: SCREEN_PART,
      code: 'import { adminListBankTransferReviews, adminUpdateBankTransferReviewAdminMemo, formatJpyAmount } from "@/features/core/bankTransferReview";',
      errors: [{ messageId: "guarded" }, { messageId: "guarded" }],
    },
    // 許可一覧は別ファイルには効かない
    {
      filename: PART,
      code: 'import { useForm } from "react-hook-form";',
      options: [{ allow: ["src/features/core/user/components/EditProfile.tsx"] }],
      errors: [{ messageId: "guarded" }],
    },
  ],
});

test("許可一覧: 各行が core の部品か既定 Screen の部品で、今も規則に当たる(当たらない行 = hook 化済み → 一覧から消す)", () => {
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
    assert.match(
      rel,
      /^(src\/features\/core\/[^/]+\/components\/.+|src\/app\/.+\/_screen\/.+)\.tsx$/,
      `core の部品・既定 Screen の部品ではない: ${rel}`,
    );
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

test("l2 指令 22 で hook 化した既定 Screen の部品は許可一覧に無い", () => {
  for (const rel of [
    "src/app/(user)/(auth)/email/verify/_screen/EmailChangeVerification.tsx",
    "src/app/(user)/(auth)/logout/_screen/LogoutSection.tsx",
    "src/app/(user)/(auth)/signup/complete/_screen/SignupCompleteSection.tsx",
    "src/app/(user)/maintenance/_screen/MaintenanceAutoRedirect.tsx",
  ]) {
    assert.ok(!CORE_UI_GUARDS_ALLOW.includes(rel), rel);
  }
});

test("まとめの再 export: services/client から再 export する値の名前だけを集める(型・他のフォルダの名前は入らない)", () => {
  const names = barrelClientNames("src/features/core/bankTransferReview", root);
  assert.ok(names.has("adminListBankTransferReviews"));
  assert.ok(names.has("adminUpdateBankTransferReviewAdminMemo"));
  assert.ok(names.has("BANK_TRANSFER_REVIEW_IMPORT_HEADERS"), "services/client の値の定数も client の側");
  assert.ok(!names.has("AdminBankTransferReviewListResponse"), "型は入らない");
  assert.ok(!names.has("formatJpyAmount"), "presenters は入らない");
  assert.ok(!names.has("STATUS_SLUG_BY_VALUE"), "constants は入らない");
  assert.equal(barrelClientNames("src/features/core/__none__", root).size, 0);
});

test("l2 計画書 07 で hook 化した管理の既定 Screen の部品は許可一覧に無く、規則に当たらない", () => {
  const linter = new Linter({ configType: "flat" });
  const config = [
    {
      files: ["**/*.tsx"],
      languageOptions: { ecmaVersion: 2022, sourceType: "module", parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { "core-ui-guards": plugin },
      rules: { "core-ui-guards/no-guard-in-part": "error" },
    },
  ];
  const BT = "src/app/admin/(protected)/bank-transfer-reviews/[status]/_screen";
  for (const rel of [
    `${BT}/StatusTabs.tsx`,
    `${BT}/BankTransferReviewListPanel.tsx`,
    `${BT}/BankTransferReviewDetailModal.tsx`,
    `${BT}/BankTransferReviewCsvImportDialog.tsx`,
    `${BT}/BankTransferReviewTable.tsx`,
    "src/app/admin/(protected)/audit-logs/_screen/AuditLogSearchPanel.tsx",
    "src/app/admin/(protected)/settings/[section]/_screen/EditSettingSectionForm.tsx",
    "src/app/admin/setup/_screen/AdminSetupForm.tsx",
  ]) {
    assert.ok(!CORE_UI_GUARDS_ALLOW.includes(rel), rel);
    const messages = linter.verify(readFileSync(at(rel), "utf8"), config, { filename: at(rel) });
    assert.deepEqual(messages.map((m) => `${m.line}: ${m.message}`), [], rel);
  }
});
