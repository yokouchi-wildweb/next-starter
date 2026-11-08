// eslint-rules/gate-rule-owner.test.mjs — 門の規則が値で読むのは 1 つの地区の config.ts だけ(目録 D14)を一時フォルダの木で確かめる
// 実行: pnpm test eslint-rules/gate-rule-owner.test.mjs
import { RuleTester } from "eslint";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import plugin, { clearGateRuleOwnerCache } from "./gate-rule-owner.mjs";

const tsParser = createRequire(import.meta.resolve("eslint-config-next"))("@typescript-eslint/parser");

const root = mkdtempSync(path.join(tmpdir(), "gate-rule-owner-"));
after(() => rmSync(root, { recursive: true, force: true }));
const FILES = {
  "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"], "@/features/wallet/*": ["./src/features/core/wallet/*"] } } }),
  "src/features/core/wallet/config.ts": "export const walletConfig = { enabled: true };\n",
  "src/features/core/wallet/config.ui.ts": "export const walletUi = {};\n",
  "src/features/core/wallet/utils/flags.ts": "export const on = true;\n",
  "src/features/core/user/config.ts": "export const userConfig = {};\n",
  "src/features/gacha/config.ts": "export const gachaConfig = { enabled: true };\n",
  "src/lib/toast/config.ts": "export const toastConfig = {};\n",
  "src/app/admin/_layout/config.ts": `export const adminLayoutConfig = { frame: "admin", enabled: true };\n`,
  "src/proxies/config.ts": "export const proxiesConfig = {};\n",
  "src/proxies/index.ts": "",
};
for (const [rel, body] of Object.entries(FILES)) {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  writeFileSync(path.join(root, rel), body);
}
clearGateRuleOwnerCache();

const RULE = path.join(root, "src/featureGate/rules/wallet.ts");
const options = [{ root }];
const ruleTester = new RuleTester({ languageOptions: { parser: tsParser, ecmaVersion: "latest", sourceType: "module" } });
const TYPE = `import type { FeatureGateRule } from "@/featureGate";\n`;

test("one-district-config: 値で読むのは 1 つの地区の config.ts だけ", () => {
  ruleTester.run("one-district-config", plugin.rules["one-district-config"], {
    valid: [
      { filename: RULE, options, code: `${TYPE}export const rule: FeatureGateRule = { pathPatterns: ["/x"], features: ["core/wallet"], enabled: () => true };` },
      { filename: RULE, options, code: `${TYPE}import { walletConfig } from "@/features/core/wallet/config";\nexport const rule = { pathPatterns: [], features: ["core/wallet"], enabled: () => walletConfig.enabled };` },
      { filename: RULE, options, code: `import { walletConfig } from "@/features/wallet/config";\nexport const rule = { features: ["core/wallet", "core/walletHistory"], enabled: () => walletConfig.enabled };` },
      { filename: RULE, options, code: `import { walletConfig } from "../../features/core/wallet/config.ts";\nexport const rule = { features: ["core/wallet"], enabled: () => walletConfig.enabled };` },
      // 住所だけの規則は名指し・値の責任で決めた 1 つの地区(features・lib・枠・proxies のどれでも)
      { filename: RULE, options, code: `import { userConfig } from "@/features/core/user/config";\nexport const rule = { pathPatterns: ["/mypage"], enabled: () => true };` },
      { filename: RULE, options, code: `import { proxiesConfig } from "@/proxies/config";\nexport const rule = { pathPatterns: ["/"], enabled: () => true };` },
      { filename: RULE, options, code: `import { adminLayoutConfig } from "@/app/admin/_layout/config";\nexport const rule = { pathPatterns: ["/admin/x"], enabled: () => adminLayoutConfig.enabled };` },
      { filename: RULE, options, code: `import { gachaConfig } from "@/features/gacha/config";\nexport const rule = { pathPatterns: ["/gacha"], enabled: () => gachaConfig.enabled };` },
      { filename: RULE, options, code: `import { toastConfig } from "@/lib/toast/config";\nexport const rule = { pathPatterns: ["/x"], enabled: () => true };` },
      // 規則でないファイルは見ない
      { filename: path.join(root, "src/featureGate/rules/wallet.test.ts"), options, code: `import a from "@/config/app/x.config";\nimport b from "@/utils/y";` },
      { filename: path.join(root, "src/featureGate/index.ts"), options, code: `import a from "@/config/app/x.config";` },
    ],
    invalid: [
      { filename: RULE, options, code: `import { APP_FEATURES } from "@/config/app/app-features.config";\nexport const rule = { features: ["core/wallet"], enabled: () => APP_FEATURES.wallet.enabled };`, errors: [{ messageId: "notConfig" }] },
      {
        filename: RULE,
        options,
        code: `import { walletConfig } from "@/features/core/wallet/config";\nimport { userConfig } from "@/features/core/user/config";\nexport const rule = { features: ["core/wallet"], enabled: () => walletConfig.enabled };`,
        errors: [{ messageId: "tooMany" }],
      },
      { filename: RULE, options, code: `import { on } from "@/features/core/wallet/utils/flags";\nexport const rule = { features: ["core/wallet"], enabled: () => on };`, errors: [{ messageId: "notConfig" }] },
      { filename: RULE, options, code: `import { walletUi } from "@/features/core/wallet/config.ui";\nexport const rule = { features: ["core/wallet"], enabled: () => true };`, errors: [{ messageId: "notConfig" }] },
      { filename: RULE, options, code: `import { userConfig } from "@/features/core/user/config";\nexport const rule = { features: ["core/wallet"], enabled: () => true };`, errors: [{ messageId: "outsideFeatures" }] },
      { filename: RULE, options, code: `export const rule = { features: ["core/wallet"], enabled: async () => (await import("@/config/app/x.config")).on };`, errors: [{ messageId: "notConfig" }] },
      { filename: RULE, options, code: `const c = require("@/features/core/wallet/config");\nconst d = require("@/features/core/user/config");\nexport const rule = { enabled: () => true };`, errors: [{ messageId: "tooMany" }] },
      { filename: RULE, options, code: `export { walletConfig } from "@/features/core/wallet/config";\nexport const rule = { features: ["core/user"], enabled: () => true };`, errors: [{ messageId: "outsideFeatures" }] },
    ],
  });
});
