// eslint-rules/deprecated-imports.test.mjs
// 旧パス import 警告規則の契約テスト。実行: pnpm test:deprecated-imports (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { RuleTester } from "eslint";

import plugin, { matchDeprecated, normalizeImportSource } from "./deprecated-imports.mjs";

const paths = [
  {
    from: "@/features/core/wallet/components/WalletBalancePage",
    to: "@/features/core/wallet/components/WalletBalance",
    until: "checkpoint ui-layers-rename の次",
  },
  {
    from: "@/features/core/user/components/UserMyPage/AccountDetails",
    to: "@/features/core/user/components/AccountDetails",
  },
];

test("normalizeImportSource: core 省略形を core 付きに揃え、それ以外は触らない", () => {
  assert.equal(normalizeImportSource("@/features/wallet/components/X"), "@/features/core/wallet/components/X");
  assert.equal(normalizeImportSource("@/features/core/wallet/components/X"), "@/features/core/wallet/components/X");
  assert.equal(normalizeImportSource("@/features/sample/components/X"), "@/features/core/sample/components/X");
  assert.equal(normalizeImportSource("@/lib/x"), "@/lib/x");
  assert.equal(normalizeImportSource("./x"), "./x");
});

test("matchDeprecated: 一致・配下・core 省略形を検出し、配下は相対部分を付け替えた候補を出す", () => {
  assert.equal(matchDeprecated("@/features/core/wallet/components/WalletBalancePage", paths).replacement, "@/features/core/wallet/components/WalletBalance");
  assert.equal(
    matchDeprecated("@/features/core/wallet/components/WalletBalancePage/BalanceCard", paths).replacement,
    "@/features/core/wallet/components/WalletBalance/BalanceCard",
  );
  assert.equal(matchDeprecated("@/features/wallet/components/WalletBalancePage", paths).replacement, "@/features/core/wallet/components/WalletBalance");
  assert.equal(matchDeprecated("@/features/core/user/components/UserMyPage/AccountDetails", paths).replacement, "@/features/core/user/components/AccountDetails");
  // 前方一致だけでは誤検出: WalletBalancePageX は別物
  assert.equal(matchDeprecated("@/features/core/wallet/components/WalletBalancePageX", paths), null);
  assert.equal(matchDeprecated("@/features/core/wallet/components/WalletBalance", paths), null);
  assert.equal(matchDeprecated("@/features/core/user/components/UserMyPage", paths), null);
});

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module" },
});

test("rule: import / export from / dynamic import の旧パスを警告し、新パスは通す", () => {
  ruleTester.run("no-deprecated-path", plugin.rules["no-deprecated-path"], {
    valid: [
      { code: `import { WalletBalance } from "@/features/core/wallet/components/WalletBalance";`, options: [{ paths }] },
      { code: `import { BalanceCard } from "@/features/core/wallet/components/WalletBalance/BalanceCard";`, options: [{ paths }] },
      { code: `import { X } from "@/features/core/wallet/components/WalletBalancePage";`, options: [{ paths: [] }] },
      { code: `import { X } from "@/features/core/wallet/components/WalletBalancePage";` },
    ],
    invalid: [
      {
        code: `import { WalletBalancePage } from "@/features/core/wallet/components/WalletBalancePage";`,
        options: [{ paths }],
        errors: [{ messageId: "deprecated" }],
      },
      {
        code: `import { BalanceCard } from "@/features/wallet/components/WalletBalancePage/BalanceCard";`,
        options: [{ paths }],
        errors: [{ messageId: "deprecated" }],
      },
      {
        code: `export { BalanceCard } from "@/features/core/wallet/components/WalletBalancePage/BalanceCard";`,
        options: [{ paths }],
        errors: [{ messageId: "deprecated" }],
      },
      {
        code: `export * from "@/features/core/wallet/components/WalletBalancePage";`,
        options: [{ paths }],
        errors: [{ messageId: "deprecated" }],
      },
      {
        code: `const m = import("@/features/core/user/components/UserMyPage/AccountDetails");`,
        options: [{ paths }],
        errors: [{ messageId: "deprecated" }],
      },
    ],
  });
});
