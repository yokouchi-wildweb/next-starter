// eslint-rules/config-overrides.test.mjs — 上書きファイルの 2 規則(literal-only・owner-reads-only)を一時フォルダの木で確かめる
// 実行: pnpm test eslint-rules/config-overrides.test.mjs
import { RuleTester } from "eslint";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import plugin, { clearConfigOverridesCache } from "./config-overrides.mjs";

const tsParser = createRequire(import.meta.resolve("eslint-config-next"))("@typescript-eslint/parser");

const root = mkdtempSync(path.join(tmpdir(), "config-overrides-lint-"));
after(() => rmSync(root, { recursive: true, force: true }));
const FILES = {
  "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"], "@lib-config/*": ["./src/config/lib/*.config.ts"] } } }),
  "src/features/core/wallet/config.ts": `export const overrideImports = ["@/lib/currencyCodes"] as const;\nexport const walletConfig = {};\n`,
  "src/features/core/wallet/config.ui.ts": `export const overrideImports = ["react-icons/fa", "@/components/Icons"] as const;\nexport const walletUi = {};\n`,
  "src/features/core/wallet/components/Balance.tsx": "",
  "src/features/gacha/config.ts": "export const gachaConfig = {};\n",
  "src/lib/toast/config.ts": "export const toastConfig = {};\n",
  "src/lib/toast/index.ts": "",
  "src/app/admin/_layout/config.ts": `export const adminLayoutConfig = { frame: "admin" };\n`,
  "src/app/page.tsx": "",
  "src/proxies/index.ts": "",
  // 基盤の上書きの持ち主(設定 D91): src/featureGate の中
  "src/featureGate/switches.ts": "",
  "src/featureGate/rules/wallet.ts": "",
};
for (const [rel, body] of Object.entries(FILES)) {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  writeFileSync(path.join(root, rel), body);
}
clearConfigOverridesCache();

const at = (rel) => path.join(root, rel);
const options = [{ root }];
const ruleTester = new RuleTester({ languageOptions: { parser: tsParser, ecmaVersion: "latest", sourceType: "module" } });

const WALLET = at("src/config/features/wallet.config.ts");
const WALLET_UI = at("src/config/features/wallet.ui.config.ts");
const GACHA = at("src/config/features/gacha.config.ts");

test("literal-only: リテラル・型・process.env・@/business・宣言した指定子は通す", () => {
  ruleTester.run("literal-only", plugin.rules["literal-only"], {
    valid: [
      { filename: GACHA, options, code: `import type { GachaOverride } from "@/features/gacha/config";\nexport default {} satisfies GachaOverride;` },
      { filename: at("src/config/lib/toast.config.ts"), options, code: `import type { ToastOverride } from "@/lib/toast";\nexport default { duration: 3000, position: "top", list: [1, -2, null, true], nested: { a: \`x\` } } as const satisfies ToastOverride;` },
      { filename: GACHA, options, code: `export type Extra = { prize: string };\nexport default { prize: "a", off: undefined, flag: !true };` },
      { filename: GACHA, options, code: `export default { enabled: process.env.GACHA_ENABLED === "on", key: process.env["GACHA_KEY"] ?? "", mode: process.env.MODE ? "a" : "b" };` },
      { filename: GACHA, options, code: `import { business } from "@/business";\nexport default { from: business.email, name: business.name };` },
      { filename: GACHA, options, code: `import { isProduction, getAppEnv as stage } from "@/lib/appEnv";\nimport type { AppEnv } from "@/lib/appEnv";\nexport default { strict: isProduction(), label: stage() === "staging" ? "stg" : "-" };` },
      { filename: GACHA, options, code: `import { isDevelopment, isStaging } from "@/lib/appEnv";\nexport default { debug: isDevelopment() || isStaging() };` },
      { filename: WALLET, options, code: `import { USD } from "@/lib/currencyCodes";\nexport default { code: USD };` },
      { filename: WALLET_UI, options, code: `import { FaCoins } from "react-icons/fa";\nimport { Icons } from "@/components/Icons";\nexport default { coin: FaCoins, gem: Icons.Gem };` },
      { filename: GACHA, options, code: `export interface Extra { a: string }\nexport type { Other } from "@/features/gacha/config";\nexport default {};` },
      // 古いフォルダ・直下のファイルは対象外
      { filename: at("src/config/app/whatever.config.ts"), options, code: `export const x = () => 1;` },
      { filename: at("src/config/business.config.ts"), options, code: `export const x = () => 1;` },
    ],
    invalid: [
      { filename: GACHA, options, code: `export default { make: () => 1 };`, errors: [{ messageId: "nonLiteral" }] },
      { filename: GACHA, options, code: `export default { make() { return 1; } };`, errors: [{ messageId: "nonLiteral" }] },
      { filename: GACHA, options, code: `export default { at: Date.now() };`, errors: [{ messageId: "nonLiteral" }] },
      { filename: GACHA, options, code: `export default { at: new Date() };`, errors: [{ messageId: "nonLiteral" }] },
      { filename: GACHA, options, code: `export default { s: \`a\${1}\` };`, errors: [{ messageId: "nonLiteral" }] },
      { filename: GACHA, options, code: `export default { ...{ a: 1 } };`, errors: [{ messageId: "nonLiteral" }] },
      { filename: GACHA, options, code: `export default { n: 1 + 2 };`, errors: [{ messageId: "nonLiteral" }] },
      { filename: GACHA, options, code: `const a = 1;\nexport default { a };`, errors: [{ messageId: "statement" }, { messageId: "nonLiteral" }] },
      { filename: GACHA, options, code: `export const a = 1;\nexport default {};`, errors: [{ messageId: "statement" }] },
      { filename: GACHA, options, code: `export default {};\nfunction f() {}`, errors: [{ messageId: "statement" }] },
      { filename: GACHA, options, code: `export const overrideImports = ["react-icons/fa"];\nexport default {};`, errors: [{ messageId: "statement" }] },
      { filename: GACHA, options, code: `import { FaCoins } from "react-icons/fa";\nexport default { coin: FaCoins };`, errors: [{ messageId: "valueImport" }] },
      { filename: GACHA, options, code: `import { other } from "@/config/features/wallet.config";\nexport default { other };`, errors: [{ messageId: "valueImport" }] },
      { filename: GACHA, options, code: `import { x } from "./wallet.config";\nexport default { x };`, errors: [{ messageId: "valueImport" }] },
      { filename: GACHA, options, code: `import "@/business";\nexport default {};`, errors: [{ messageId: "sideEffect" }] },
      // 値の config の宣言は描画用の上書きに効かない(部品は config.ui.ts の宣言だけ)
      { filename: WALLET, options, code: `import { FaCoins } from "react-icons/fa";\nexport default { coin: FaCoins };`, errors: [{ messageId: "valueImport" }] },
      { filename: GACHA, options, code: `import { withAppEnv } from "@/lib/appEnv";\nexport default {};`, errors: [{ messageId: "stageImport" }] },
      { filename: GACHA, options, code: `import appEnv from "@/lib/appEnv";\nexport default {};`, errors: [{ messageId: "stageImport" }] },
      { filename: GACHA, options, code: `import { isProduction } from "@/lib/appEnv";\nexport default { strict: isProduction("x") };`, errors: [{ messageId: "nonLiteral" }] },
      { filename: GACHA, options, code: `import { isProduction } from "@/lib/appEnv";\nexport default { check: isProduction };`, errors: [{ messageId: "nonLiteral" }] },
      { filename: GACHA, options, code: `import { business } from "@/business";\nexport default { x: business.make() };`, errors: [{ messageId: "nonLiteral" }] },
      { filename: GACHA, options, code: `export type Extra = {};`, errors: [{ messageId: "noDefault" }] },
      { filename: at("src/config/features/ghost.config.ts"), options, code: `export default {};`, errors: [{ messageId: "noOwner" }] },
    ],
  });
});

test("owner-reads-only: 上書きを読めるのは持ち主の config.ts(描画用は config.ui.ts)だけ", () => {
  ruleTester.run("owner-reads-only", plugin.rules["owner-reads-only"], {
    valid: [
      { filename: at("src/features/core/wallet/config.ts"), options, code: `import override from "@/config/features/wallet.config";` },
      { filename: at("src/features/core/wallet/config.ts"), options, code: `import override from "../../../config/features/wallet.config.ts";` },
      { filename: at("src/features/core/wallet/config.ui.ts"), options, code: `import override from "@/config/features/wallet.ui.config";` },
      { filename: at("src/app/admin/_layout/config.ts"), options, code: `import override from "src/config/layout/admin.config";` },
      // lib の中は lib-entry の持ち分
      { filename: at("src/lib/toast/config.ts"), options, code: `import override from "@lib-config/toast";` },
      { filename: at("src/lib/toast/index.ts"), options, code: `import override from "@lib-config/toast";` },
      { filename: at("src/app/page.tsx"), options, code: `import { walletConfig } from "@/features/wallet/config";` },
    ],
    invalid: [
      { filename: at("src/features/core/wallet/components/Balance.tsx"), options, code: `import override from "@/config/features/wallet.config";`, errors: [{ messageId: "notOwner" }] },
      { filename: at("src/features/core/wallet/components/Balance.tsx"), options, code: `import type { Extra } from "@/config/features/wallet.config";`, errors: [{ messageId: "notOwner" }] },
      { filename: at("src/features/core/wallet/config.ts"), options, code: `import ui from "@/config/features/wallet.ui.config";`, errors: [{ messageId: "notOwner" }] },
      { filename: at("src/app/page.tsx"), options, code: `import toast from "@lib-config/toast";`, errors: [{ messageId: "notOwner" }] },
      { filename: at("src/app/page.tsx"), options, code: `const m = await import("@/config/layout/admin.config");`, errors: [{ messageId: "notOwner" }] },
      { filename: at("src/features/gacha/config.ts"), options, code: `export { default } from "@/config/features/wallet.config";`, errors: [{ messageId: "notOwner" }] },
      { filename: at("src/app/page.tsx"), options, code: `import x from "@/config/features/ghost.config";`, errors: [{ messageId: "noOwner" }] },
    ],
  });
});

const SWITCHES = at("src/config/featureGate/switches.config.ts");

test("基盤の上書き src/config/featureGate/(設定 D91・L1.31): リテラルだけ、読めるのは src/featureGate の中だけ", () => {
  ruleTester.run("literal-only", plugin.rules["literal-only"], {
    valid: [
      { filename: SWITCHES, options, code: `import type { FeatureSwitches } from "@/featureGate";\nexport default { wallet: false, coupon: true } satisfies FeatureSwitches;` },
      { filename: SWITCHES, options, code: `import { isProduction } from "@/lib/appEnv";\nexport default { wallet: isProduction() };` },
    ],
    invalid: [
      { filename: SWITCHES, options, code: `export default { wallet: Boolean(process.env.X) };`, errors: [{ messageId: "nonLiteral" }] },
      { filename: SWITCHES, options, code: `import { WALLET } from "@/features/wallet/config";\nexport default { wallet: WALLET };`, errors: [{ messageId: "valueImport" }] },
      { filename: SWITCHES, options, code: `export const x = 1;\nexport default {};`, errors: [{ messageId: "statement" }] },
    ],
  });
  ruleTester.run("owner-reads-only", plugin.rules["owner-reads-only"], {
    valid: [
      { filename: at("src/featureGate/switches.ts"), options, code: `import switches from "@/config/featureGate/switches.config";` },
      { filename: at("src/featureGate/rules/wallet.ts"), options, code: `import switches from "../../config/featureGate/switches.config";` },
    ],
    invalid: [
      { filename: at("src/features/gacha/config.ts"), options, code: `import switches from "@/config/featureGate/switches.config";`, errors: [{ messageId: "notOwner" }] },
      { filename: at("src/app/page.tsx"), options, code: `import type { Extra } from "@/config/featureGate/switches.config";`, errors: [{ messageId: "notOwner" }] },
    ],
  });
});

