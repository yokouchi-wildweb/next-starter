// eslint-rules/core-ui-entry.test.mjs
// core の部品の入口の規則の契約テスト。実行: pnpm test:core-ui-entry (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { RuleTester } from "eslint";

import plugin, { corePartFolderOf } from "./core-ui-entry.mjs";

const tsParser = createRequire(import.meta.resolve("eslint-config-next"))("@typescript-eslint/parser");
const C = "src/features/core/wallet/components";

test("corePartFolderOf: 入口は null、中身は部品のフォルダ", () => {
  assert.equal(corePartFolderOf(`${C}/WalletBalance`), null);
  assert.equal(corePartFolderOf(`${C}/WalletBalance.tsx`), null);
  assert.equal(corePartFolderOf(`${C}/WalletBalance/index`), null);
  assert.equal(corePartFolderOf(`${C}/WalletBalance/index.tsx`), null);
  assert.equal(corePartFolderOf(`${C}/common/Row`), null);
  assert.equal(corePartFolderOf(`${C}/common/Row.tsx`), null);
  assert.equal(corePartFolderOf(`${C}/common/Row/index`), null);
  assert.equal(corePartFolderOf(`${C}/WalletBalance/Card`), `${C}/WalletBalance`);
  assert.equal(corePartFolderOf(`${C}/WalletBalance/a/b`), `${C}/WalletBalance`);
  assert.equal(corePartFolderOf(`${C}/common/Row/Cell`), `${C}/common/Row`);
  assert.equal(corePartFolderOf("src/features/core/wallet/hooks/useX"), null);
  assert.equal(corePartFolderOf("src/features/gacha/components/A/B"), null);
  assert.equal(corePartFolderOf("src/components/Form/Input"), null);
  assert.equal(corePartFolderOf(null), null);
});

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module", parser: tsParser },
});
const root = process.cwd();
const at = (rel) => `${root}/${rel}`;

tester.run("core-ui-entry/no-inner-import", plugin.rules["no-inner-import"], {
  valid: [
    { filename: at("src/app/x/_components/A.tsx"), code: 'import { WalletBalance } from "@/features/core/wallet/components/WalletBalance";' },
    { filename: at("src/app/x/_components/A.tsx"), code: 'import { WalletBalance } from "@/features/wallet/components/WalletBalance";' },
    { filename: at("src/app/x/_components/A.tsx"), code: 'import { Row } from "@/features/core/wallet/components/common/Row";' },
    // フォルダの中どうしは自由
    { filename: at(`${C}/WalletBalance/index.tsx`), code: 'import { Card } from "./Card";' },
    { filename: at(`${C}/WalletBalance/a/b.tsx`), code: 'import { Card } from "../Card";' },
    // 型だけは対象外
    { filename: at("src/app/x/_components/A.tsx"), code: 'import type { Props } from "@/features/core/wallet/components/WalletBalance/Card";' },
    // 生成された一覧は受け口の項目を読む
    { filename: at("src/features/core/milestone/extensions/renderers.ts"), code: 'import { renderer } from "@/features/core/milestone/components/renderers/x.child";' },
    // core の外
    { filename: at("src/app/x/_components/A.tsx"), code: 'import { B } from "@/features/gacha/components/A/B";' },
  ],
  invalid: [
    { filename: at("src/app/x/_components/A.tsx"), code: 'import { Card } from "@/features/core/wallet/components/WalletBalance/Card";', errors: [{ messageId: "inner" }] },
    // core/ を省いた別名
    { filename: at("src/app/x/_components/A.tsx"), code: 'import { Card } from "@/features/wallet/components/WalletBalance/Card";', errors: [{ messageId: "inner" }] },
    { filename: at("src/app/x/_components/A.tsx"), code: 'import { Cell } from "@/features/wallet/components/common/Row/Cell";', errors: [{ messageId: "inner" }] },
    // 同じドメインでもフォルダの外からは同じ。相対も解く
    { filename: at(`${C}/WalletPurchase/index.tsx`), code: 'import { Card } from "../WalletBalance/Card";', errors: [{ messageId: "inner" }] },
    // barrel で再 export しても、dynamic import でも
    { filename: at("src/app/x/_components/barrel.ts"), code: 'export { Card } from "@/features/wallet/components/WalletBalance/Card";', errors: [{ messageId: "inner" }] },
    { filename: at("src/app/x/_components/barrel.ts"), code: 'export * from "@/features/wallet/components/WalletBalance/Card";', errors: [{ messageId: "inner" }] },
    { filename: at("src/app/x/_components/A.tsx"), code: 'const C = () => import("@/features/wallet/components/WalletBalance/Card");', errors: [{ messageId: "inner" }] },
  ],
});
