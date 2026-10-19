// eslint-rules/client-service-boundary.test.mjs
// UI からの ClientService 直接 import 検出の契約テスト。実行: pnpm test:client-service-boundary (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { RuleTester } from "eslint";

import plugin, { classifyImport } from "./client-service-boundary.mjs";

// `import type` を解析するため TS パーサーを使う。直接依存にはしていないので eslint-config-next 経由で解決する
const tsParser = createRequire(import.meta.resolve("eslint-config-next"))("@typescript-eslint/parser");

test("classifyImport: services/client パス(絶対・相対)とまとめ import の *Client を検出し、型だけなら通す", () => {
  const v = (name) => ({ name, typeOnly: false });
  const t = (name) => ({ name, typeOnly: true });
  assert.equal(classifyImport("@/features/core/user/services/client/userClient", [v("userClient")]), "path");
  assert.equal(classifyImport("../../services/client/referralsByInviter", [v("getReferralsByInviter")]), "path");
  assert.equal(classifyImport("@/features/sample/services/client", null), "path");
  assert.equal(classifyImport("@/features/core/auditLog", [v("auditLogClient"), v("formatAuditDate")]), "barrel");
  assert.equal(classifyImport("@/features/auditLog", [v("auditLogClient")]), "barrel");
  // 型だけ
  assert.equal(classifyImport("@/features/core/user/services/client/userClient", [t("UserQuery")]), null);
  assert.equal(classifyImport("@/features/core/user/services/client/userClient", [v("x")], true), null);
  assert.equal(classifyImport("@/features/core/auditLog", [t("auditLogClient")]), null);
  // 対象外
  assert.equal(classifyImport("@/features/core/auditLog", [v("AuditTimeline")]), null);
  assert.equal(classifyImport("@/features/core/auditLog/hooks/useAuditLogSearch", [v("useAuditLogSearch")]), null);
  assert.equal(classifyImport("@/features/core/user/components/common/UserAsyncCombobox", [v("apiClient")]), null);
  assert.equal(classifyImport("@/lib/services/clientish", [v("x")]), null);
});

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module", parser: tsParser },
});

test("rule: 値 import・まとめ import・dynamic import を検出し、型 import とフック import は通す", () => {
  ruleTester.run("no-direct-import", plugin.rules["no-direct-import"], {
    valid: [
      { code: `import { useAuditLogSearch } from "@/features/core/auditLog/hooks/useAuditLogSearch";` },
      { code: `import type { ReferralByInviterItem } from "../../services/client/referralsByInviter";` },
      { code: `import { type ReferralByInviterItem } from "@/features/core/referral/services/client/referralsByInviter";` },
      { code: `import { AuditTimeline, formatAuditDate } from "@/features/core/auditLog";` },
    ],
    invalid: [
      {
        code: `import { userClient } from "@/features/core/user/services/client/userClient";`,
        errors: [{ messageId: "path" }],
      },
      {
        code: `import { getReferralsByInviter, type ReferralByInviterItem } from "../../services/client/referralsByInviter";`,
        errors: [{ messageId: "path" }],
      },
      {
        code: `import * as client from "@/features/sample/services/client/sampleClient";`,
        errors: [{ messageId: "path" }],
      },
      {
        code: `import { auditLogClient, formatAuditDate } from "@/features/core/auditLog";`,
        errors: [{ messageId: "barrel" }],
      },
      {
        code: `const m = import("@/features/sample/services/client/sampleClient");`,
        errors: [{ messageId: "path" }],
      },
    ],
  });
});
