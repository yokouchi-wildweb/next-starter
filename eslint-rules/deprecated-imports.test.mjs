// eslint-rules/deprecated-imports.test.mjs
// 旧パス import 警告規則の契約テスト。実行: pnpm test eslint-rules/deprecated-imports.test.mjs (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { ESLint, RuleTester } from "eslint";

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

test("config: 部品の棚 Primitives へ移した旧パス(_shadcn・Overlays の *Primitives・Badge/BadgeCore)は置き換え先を出して warn", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const eslint = new ESLint({ cwd: repoRoot, overrideConfigFile: path.join(repoRoot, "eslint.config.mjs") });
  const cases = [
    ["@/components/_shadcn/checkbox", "@/components/Primitives/Checkbox"],
    ["@/components/_shadcn/textarea", "@/components/Primitives/Input"],
    ["@/components/_shadcn/dialog", "@/components/Primitives/Dialog"],
    ["@/components/Overlays/DialogPrimitives", "@/components/Primitives/Dialog"],
    ["@/components/Overlays/CommandPrimitives", "@/components/Primitives/Command"],
    ["@/components/Overlays/Popover/PopoverPrimitives", "@/components/Primitives/Popover"],
    ["@/components/Badge/BadgeCore", "@/components/Primitives/Badge"],
  ];
  for (const [from, to] of cases) {
    const [result] = await eslint.lintText(`import * as X from "${from}";\nexport const y = X;\n`, {
      filePath: path.join(repoRoot, "src/components/Form/X.tsx"),
    });
    const hits = result.messages.filter((m) => m.ruleId === "deprecated-imports/no-deprecated-path");
    assert.equal(hits.length, 1, from);
    assert.equal(hits[0].severity, 1, from);
    assert.ok(hits[0].message.includes(`"${to}"`), hits[0].message);
  }
  // 残る _shadcn(accordion など)と新しいパスは案内しない
  const [kept] = await eslint.lintText(`import * as A from "@/components/Primitives/Dialog";\nexport const y = A;\n`, {
    filePath: path.join(repoRoot, "src/components/Form/X.tsx"),
  });
  assert.equal(kept.messages.filter((m) => m.ruleId === "deprecated-imports/no-deprecated-path").length, 0);
});

test("config: stores の廃止で閉じた lib へ移した旧パス(viewport)は @/lib/viewport を出して warn", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const eslint = new ESLint({ cwd: repoRoot, overrideConfigFile: path.join(repoRoot, "eslint.config.mjs") });
  const olds = [
    "@/stores/viewportSize",
    "@/hooks/useViewportOrientation",
    "@/hooks/useMediaQuery",
    "@/components/Fanctional/ViewportHeightWatcher",
  ];
  for (const from of olds) {
    const [result] = await eslint.lintText(`import * as X from "${from}";\nexport const y = X;\n`, {
      filePath: path.join(repoRoot, "src/components/Form/X.tsx"),
    });
    const hits = result.messages.filter((m) => m.ruleId === "deprecated-imports/no-deprecated-path");
    assert.equal(hits.length, 1, from);
    assert.equal(hits[0].severity, 1, from);
    assert.ok(hits[0].message.includes('"@/lib/viewport"'), hits[0].message);
  }
});

test("config: stores の廃止で閉じた lib へ移した旧パス(siteTheme)は @/lib/siteTheme を出して warn", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const eslint = new ESLint({ cwd: repoRoot, overrideConfigFile: path.join(repoRoot, "eslint.config.mjs") });
  const olds = [
    "@/stores/siteTheme",
    "@/utils/siteTheme",
    "@/components/Fanctional/SiteThemeSync",
    "@/config/ui/site-theme.config",
  ];
  for (const from of olds) {
    const [result] = await eslint.lintText(`import * as X from "${from}";\nexport const y = X;\n`, {
      filePath: path.join(repoRoot, "src/components/Form/X.tsx"),
    });
    const hits = result.messages.filter((m) => m.ruleId === "deprecated-imports/no-deprecated-path");
    assert.equal(hits.length, 1, from);
    assert.equal(hits[0].severity, 1, from);
    assert.ok(hits[0].message.includes('"@/lib/siteTheme"'), hits[0].message);
  }
});

test("config: stores の廃止で閉じた lib へ移した旧パス(globalLoader)は @/lib/globalLoader を出して warn", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const eslint = new ESLint({ cwd: repoRoot, overrideConfigFile: path.join(repoRoot, "eslint.config.mjs") });
  const olds = ["@/stores/globalLoader", "@/hooks/useGlobalLoader", "@/components/Overlays/Loading/GlobalScreenLoader"];
  for (const from of olds) {
    const [result] = await eslint.lintText(`import * as X from "${from}";\nexport const y = X;\n`, {
      filePath: path.join(repoRoot, "src/components/Form/X.tsx"),
    });
    const hits = result.messages.filter((m) => m.ruleId === "deprecated-imports/no-deprecated-path");
    assert.equal(hits.length, 1, from);
    assert.equal(hits[0].severity, 1, from);
    assert.ok(hits[0].message.includes('"@/lib/globalLoader"'), hits[0].message);
  }
});
