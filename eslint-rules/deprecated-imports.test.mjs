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

test("matchDeprecated: collapse は配下も検出し、候補は配下の道を付けずに to そのもの", () => {
  const collapse = [{ from: "@/components/Form", to: "@/lib/formSuite", collapse: true }];
  assert.equal(matchDeprecated("@/components/Form", collapse).replacement, "@/lib/formSuite");
  assert.equal(matchDeprecated("@/components/Form/Field/types", collapse).replacement, "@/lib/formSuite");
  assert.equal(matchDeprecated("@/components/FormX", collapse), null);
});

test("matchDeprecated: exact は from そのもの(と /index)だけを検出し、配下は通す", () => {
  const exact = [{ from: "@/components/Layout", to: "@/components/Layout/<Unit>", exact: true }];
  assert.equal(matchDeprecated("@/components/Layout", exact).replacement, "@/components/Layout/<Unit>");
  assert.equal(matchDeprecated("@/components/Layout/index", exact).replacement, "@/components/Layout/<Unit>");
  assert.equal(matchDeprecated("@/components/Layout/Block", exact), null);
  assert.equal(matchDeprecated("@/components/LayoutX", exact), null);
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

test("config: 部品の棚 Primitives・素の表 PlainTable へ移した旧パス(_shadcn・Overlays の *Primitives・Badge/BadgeCore)は置き換え先を出して warn", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const eslint = new ESLint({ cwd: repoRoot, overrideConfigFile: path.join(repoRoot, "eslint.config.mjs") });
  const cases = [
    ["@/components/_shadcn/checkbox", "@/components/Primitives/Checkbox"],
    ["@/components/_shadcn/textarea", "@/components/Primitives/Input"],
    ["@/components/_shadcn/dialog", "@/components/Primitives/Dialog"],
    ["@/components/_shadcn/table", "@/lib/tableSuite"],
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
  // 移し先の無い旧パス(_shadcn の form・card など)と新しいパスは案内しない
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

test("config: 持ち主の lib へ移した Provider(RecaptchaProvider)は @/lib/recaptcha を出して warn", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const eslint = new ESLint({ cwd: repoRoot, overrideConfigFile: path.join(repoRoot, "eslint.config.mjs") });
  const [result] = await eslint.lintText(`import { RecaptchaProvider } from "@/components/Providers/RecaptchaProvider";\nexport const y = RecaptchaProvider;\n`, {
    filePath: path.join(repoRoot, "src/components/Form/X.tsx"),
  });
  const hits = result.messages.filter((m) => m.ruleId === "deprecated-imports/no-deprecated-path");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].severity, 1);
  assert.ok(hits[0].message.includes('"@/lib/recaptcha"'), hits[0].message);
});

test("config: 綴りを直した部品の棚の旧フォルダ Fanctional は Functional の同じ名を出して warn", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const eslint = new ESLint({ cwd: repoRoot, overrideConfigFile: path.join(repoRoot, "eslint.config.mjs") });
  for (const [from, to] of [
    ["@/components/Fanctional", "@/components/Functional"],
    ["@/components/Fanctional/BodyPortal", "@/components/Functional/BodyPortal"],
    ["@/components/Fanctional/DarkModeSwitch", "@/components/Functional/DarkModeSwitch"],
  ]) {
    const [result] = await eslint.lintText(`import * as X from "${from}";\nexport const y = X;\n`, {
      filePath: path.join(repoRoot, "src/components/Form/X.tsx"),
    });
    const hits = result.messages.filter((m) => m.ruleId === "deprecated-imports/no-deprecated-path");
    assert.equal(hits.length, 1, from);
    assert.ok(hits[0].message.includes(`"${to}"`), hits[0].message);
  }
});

test("config: 棚の場所の整理(shelf-s1)の旧パスは置き換え先を出して warn し、消した入口の配下の部品は通す", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const eslint = new ESLint({ cwd: repoRoot, overrideConfigFile: path.join(repoRoot, "eslint.config.mjs") });
  const lint = async (from) => {
    const [result] = await eslint.lintText(`import * as X from "${from}";\nexport const y = X;\n`, {
      filePath: path.join(repoRoot, "src/components/Form/X.tsx"),
    });
    return result.messages.filter((m) => m.ruleId === "deprecated-imports/no-deprecated-path");
  };
  const cases = [
    ["@/components/Layout", "@/components/Layout/<Unit>"],
    ["@/components/TextBlocks", "@/components/TextBlocks/<Unit>"],
    ["@/components/Functional", "@/components/Functional/<Unit>"],
    ["@/components/Layout/spacing", "@/lib/spacing"],
    ["@/components/Layout/spacingScale", "@/lib/spacing"],
    ["@/components/Layout/spacingClasses.generated", "@/lib/spacing"],
    ["@/components/Layout/commonVariants", "@/components/Layout/appearance"],
    ["@/components/AppFrames/Kiosk", "@/components/Layout/KioskFrame"],
    ["@/components/AppFrames/Kiosk/KioskFrame", "@/components/Layout/KioskFrame"],
    ["@/components/Functional/BodyPortal", "@/components/Overlays/BodyPortal"],
    ["@/hooks/useHeaderHeight", "@/app/_layout/useHeaderHeight"],
    ["@/components/AppFrames/Admin/Elements/ListTop", "@/components/Admin/ListTop"],
  ];
  for (const [from, to] of cases) {
    const hits = await lint(from);
    assert.equal(hits.length, 1, from);
    assert.equal(hits[0].severity, 1, from);
    assert.ok(hits[0].message.includes(`"${to}"`), hits[0].message);
  }
  for (const kept of ["@/components/Layout/Block", "@/components/Navigation/Link", "@/components/Overlays/Dialog", "@/components/Button/Button"]) {
    assert.equal((await lint(kept)).length, 0, kept);
  }
});

test("config: lib の小物の移行(shelf-s3)の旧パスは置き換え先を出して warn する", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const eslint = new ESLint({ cwd: repoRoot, overrideConfigFile: path.join(repoRoot, "eslint.config.mjs") });
  for (const [from, to] of [
    ["@/utils/object", "@/lib/crud/server"],
    ["@/utils/json", "@/lib/firebase"],
    ["@/hooks/useAppStatus", "@/lib/appStatus"],
    ["@/components/AppStatusGuard", "@/lib/appStatus"],
    ["@/components/Functional/DarkModeSwitch", "@/lib/siteTheme"],
  ]) {
    const [result] = await eslint.lintText(`import * as X from "${from}";\nexport const y = X;\n`, {
      filePath: path.join(repoRoot, "src/features/sample/components/X.tsx"),
    });
    const hits = result.messages.filter((m) => m.ruleId === "deprecated-imports/no-deprecated-path");
    assert.equal(hits.length, 1, from);
    assert.equal(hits[0].severity, 1, from);
    assert.ok(hits[0].message.includes(`"${to}`), hits[0].message);
  }
});
