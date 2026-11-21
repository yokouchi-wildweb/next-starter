// eslint-rules/entry.test.mjs
// 入口の規則 entry/only-entries(棚の単位・core の部品・宣言済みの lib)と、lib の中の自分の読み方 import-boundaries の
// lib-self-relative の契約テスト。fixture の repo は一時フォルダに作り、規則の option root でそこを読ませる(src の下に置かない)。
// 実行: pnpm test eslint-rules/entry.test.mjs (node:test)
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { RuleTester } from "eslint";

import entryPlugin, { corePartFolderOf, shelfUnitFolderOf } from "./entry.mjs";
import plugin from "./import-boundaries.mjs";

const tsParser = createRequire(import.meta.resolve("eslint-config-next"))("@typescript-eslint/parser");
const root = mkdtempSync(path.join(tmpdir(), "entry-"));
after(() => rmSync(root, { recursive: true, force: true }));

function write(rel, content) {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content, null, 2));
}

write("tsconfig.json", { compilerOptions: { paths: { "@/*": ["./src/*"], "@/features/wallet/*": ["./src/features/core/wallet/*"] } } });
// toastlike: 宣言済み(入口 . と ./client)。cn を読み、棚 components を peer に持つ
write("src/lib/toastlike/package.json", {
  exports: { ".": "./index.ts", "./client": "./client.ts" },
  libs: ["cn", "plain"],
  peers: ["components"],
});
for (const file of ["index.ts", "client.ts", "inner/store.ts"]) write(`src/lib/toastlike/${file}`, "export {};\n");
// cn: 宣言済み(入口 . だけ)
write("src/lib/cn/package.json", { exports: { ".": "./index.ts" } });
for (const file of ["index.ts", "groups.ts"]) write(`src/lib/cn/${file}`, "export {};\n");
// plain・other: 宣言なし
write("src/lib/plain/index.ts", "export {};\n");
write("src/lib/plain/deep.ts", "export {};\n");
write("src/lib/other/index.ts", "export {};\n");

const at = (rel) => path.join(root, rel);
const options = [{ root }];
const outside = at("src/features/x/components/A.tsx");
const inToast = at("src/lib/toastlike/inner/store.ts");
const inPlain = at("src/lib/plain/index.ts");

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module", parser: tsParser },
});

test("entry/only-entries(lib): 外から宣言済みの lib は exports の入口だけ(別名・相対・\"src/…\"・dynamic・require・型も実パスで照合)", () => {
  ruleTester.run("entry/only-entries", entryPlugin.rules["only-entries"], {
    valid: [
      { code: `import { useToast } from "@/lib/toastlike";`, filename: outside, options },
      { code: `import { useToast } from "@/lib/toastlike/client";`, filename: outside, options },
      { code: `import { x } from "@/lib/toastlike/index";`, filename: outside, options },
      { code: `import { x } from "../../../lib/toastlike/client.ts";`, filename: outside, options },
      { code: `import { x } from "src/lib/toastlike";`, filename: outside, options },
      { code: `const m = await import("@/lib/toastlike/client");`, filename: outside, options },
      { code: `import { x } from "@/lib/plain/deep";`, filename: outside, options, name: "宣言の無い lib の中は見ない(L1.21)" },
      { code: `import { x } from "@/lib/toastlike";`, filename: at("scripts/tool/run.mjs"), options },
      { code: `import { x } from "react"; import fs from "node:fs";`, filename: outside, options },
    ],
    invalid: [
      { code: `import { store } from "@/lib/toastlike/inner/store";`, filename: outside, options, errors: [{ messageId: "libInner" }] },
      { code: `import type { Store } from "@/lib/toastlike/inner/store";`, filename: outside, options, errors: [{ messageId: "libInner" }] },
      { code: `import { store } from "../../../lib/toastlike/inner/store";`, filename: outside, options, errors: [{ messageId: "libInner" }] },
      { code: `import { store } from "src/lib/toastlike/inner/store.ts";`, filename: outside, options, errors: [{ messageId: "libInner" }] },
      { code: `const m = await import("@/lib/toastlike/inner/store");`, filename: outside, options, errors: [{ messageId: "libInner" }] },
      { code: `const m = require("@/lib/toastlike/inner/store");`, filename: outside, options, errors: [{ messageId: "libInner" }] },
      { code: `export { store } from "@/lib/toastlike/inner/store";`, filename: outside, options, errors: [{ messageId: "libInner" }] },
      { code: `export * from "@/lib/cn/groups";`, filename: outside, options, errors: [{ messageId: "libInner" }] },
      {
        code: `import { x } from "@/lib/cn/groups";`,
        filename: at("scripts/tool/run.test.mjs"),
        options,
        errors: [{ messageId: "libInner" }],
        name: "scripts・テストからの読みも対象(D84)",
      },
      {
        code: `import { x } from "@/lib/cn/groups";`,
        filename: inPlain,
        options,
        errors: [{ messageId: "libInner" }],
        name: "宣言の無い lib から読むときも相手の入口は守る",
      },
    ],
  });
});

test("entry/only-entries(lib): 宣言済みの lib は宣言した lib の入口・peers の棚・@lib-config/<自分>(と <自分>.ui)だけを読む", () => {
  ruleTester.run("entry/only-entries", entryPlugin.rules["only-entries"], {
    valid: [
      { code: `import { cn } from "@/lib/cn";`, filename: inToast, options },
      { code: `import { x } from "@/lib/plain/deep";`, filename: inToast, options, name: "宣言した相手が未宣言なら入口の照合はしない" },
      { code: `import { Button } from "@/components/Button/Button";`, filename: inToast, options },
      { code: `import config from "@lib-config/toastlike";`, filename: inToast, options },
      { code: `import ui from "@lib-config/toastlike.ui";`, filename: inToast, options, name: "描画専用の上書き(config.ui.ts の口)も自分の設定" },
      { code: `import { x } from "../client"; import { y } from "./other";`, filename: inToast, options },
      { code: `import { create } from "zustand";`, filename: inToast, options },
      { code: `import { x } from "@/hooks/useIsClient";`, filename: inPlain, options, name: "宣言の無い lib の読みは見ない(L1.21)" },
    ],
    invalid: [
      { code: `import { x } from "@/lib/other";`, filename: inToast, options, errors: [{ messageId: "undeclaredLib" }] },
      { code: `import type { X } from "../../other";`, filename: inToast, options, errors: [{ messageId: "undeclaredLib" }] },
      { code: `import { x } from "@/lib/cn/groups";`, filename: inToast, options, errors: [{ messageId: "libInner" }] },
      { code: `import { x } from "@/hooks/useIsClient";`, filename: inToast, options, errors: [{ messageId: "undeclaredPath" }] },
      { code: `import { x } from "@/features/user/hooks";`, filename: inToast, options, errors: [{ messageId: "undeclaredPath" }] },
      { code: `import { x } from "@/config/ui/fonts.config";`, filename: inToast, options, errors: [{ messageId: "undeclaredPath" }] },
      { code: `import c from "@/config/lib/toastlike.config";`, filename: inToast, options, errors: [{ messageId: "undeclaredPath" }] },
      { code: `import c from "src/config/lib/toastlike.config";`, filename: inToast, options, errors: [{ messageId: "undeclaredPath" }] },
      { code: `import c from "@lib-config/cn";`, filename: inToast, options, errors: [{ messageId: "libConfigOther" }] },
      { code: `import c from "@lib-config/cn.ui";`, filename: inToast, options, errors: [{ messageId: "libConfigOther" }] },
      { code: `import c from "@lib-config/toastlike.uix";`, filename: inToast, options, errors: [{ messageId: "libConfigOther" }] },
      { code: `import c from "@lib-config/toastlike/extra";`, filename: inToast, options, errors: [{ messageId: "libConfigOther" }] },
    ],
  });
});

test("rule lib-self-relative: 宣言済みの lib の中で自分を別名で読むと error、相対と宣言の無い lib は通す", () => {
  ruleTester.run("lib-self-relative", plugin.rules["lib-self-relative"], {
    valid: [
      { code: `import { x } from "../client";`, filename: inToast, options },
      { code: `import { cn } from "@/lib/cn";`, filename: inToast, options },
      { code: `import { x } from "@/lib/plain/deep";`, filename: inPlain, options, name: "宣言の無い lib は見ない(L1.21)" },
      { code: `import { x } from "@/lib/toastlike";`, filename: outside, options },
    ],
    invalid: [
      { code: `import { x } from "@/lib/toastlike/client";`, filename: inToast, options, errors: [{ messageId: "selfAlias" }] },
      { code: `import { x } from "@/lib/toastlike";`, filename: inToast, options, errors: [{ messageId: "selfAlias" }] },
      { code: `import type { X } from "src/lib/toastlike/index";`, filename: inToast, options, errors: [{ messageId: "selfAlias" }] },
      { code: `const m = await import("@/lib/toastlike/inner/store");`, filename: inToast, options, errors: [{ messageId: "selfAlias" }] },
    ],
  });
});

const C = "src/features/core/wallet/components";

test("corePartFolderOf: 入口は null、中身は部品のフォルダ", () => {
  assert.equal(corePartFolderOf(`${C}/WalletBalance`), null);
  assert.equal(corePartFolderOf(`${C}/WalletBalance.tsx`), null);
  assert.equal(corePartFolderOf(`${C}/WalletBalance/index`), null);
  assert.equal(corePartFolderOf(`${C}/common/Row`), null);
  assert.equal(corePartFolderOf(`${C}/common/Row.tsx`), null);
  assert.equal(corePartFolderOf(`${C}/common/Row/index`), null);
  assert.equal(corePartFolderOf(`${C}/WalletBalance/Card`), `${C}/WalletBalance`);
  assert.equal(corePartFolderOf(`${C}/WalletBalance/a/b`), `${C}/WalletBalance`);
  assert.equal(corePartFolderOf(`${C}/common/Row/Cell`), `${C}/common/Row`);
  assert.equal(corePartFolderOf("src/features/core/wallet/hooks/useX"), null);
  assert.equal(corePartFolderOf("src/features/gacha/components/A/B"), null);
  assert.equal(corePartFolderOf(null), null);
});

test("shelfUnitFolderOf: 単位のファイル・index は null、単位のフォルダの中身はそのフォルダ", () => {
  assert.equal(shelfUnitFolderOf("src/components/Layout/Stack"), null);
  assert.equal(shelfUnitFolderOf("src/components/Layout/Stack.tsx"), null);
  assert.equal(shelfUnitFolderOf("src/components/Overlays/Popover"), null);
  assert.equal(shelfUnitFolderOf("src/components/Overlays/Popover/index"), null);
  assert.equal(shelfUnitFolderOf("src/components/Overlays/Popover/index.ts"), null);
  assert.equal(shelfUnitFolderOf("src/components/Overlays/Popover/InfoPopover"), "src/components/Overlays/Popover");
  assert.equal(shelfUnitFolderOf("src/components/Overlays/Popover/a/b"), "src/components/Overlays/Popover");
  assert.equal(shelfUnitFolderOf("src/components/Guard"), null, "直下が index だけの分類");
  assert.equal(shelfUnitFolderOf("src/lib/cn/index"), null);
  assert.equal(shelfUnitFolderOf(null), null);
});

test("entry/only-entries(棚の単位): 入口だけ。値も型も、別名も相対も。同じ単位の中と __fixtures__ をテストから読むのは通す", () => {
  const screen = at("src/app/x/_components/A.tsx");
  ruleTester.run("entry/only-entries", entryPlugin.rules["only-entries"], {
    valid: [
      { code: `import { Stack } from "@/components/Layout/Stack";`, filename: screen, options },
      { code: `import { InfoPopover } from "@/components/Overlays/Popover";`, filename: screen, options },
      { code: `import { x } from "@/components/Overlays/Popover/index";`, filename: screen, options },
      { code: `import { x } from "./InfoPopover";`, filename: at("src/components/Overlays/Popover/index.ts"), options, name: "同じ単位の中" },
      { code: `import { x } from "../Popover";`, filename: at("src/components/Overlays/Popover/a/b.tsx"), options, name: "同じ単位の中(深い所)" },
      { code: `import { x } from "@/components/Input/__fixtures__/data";`, filename: at("src/components/Overlays/Modal.test.tsx"), options, name: "テストから __fixtures__" },
    ],
    invalid: [
      { code: `import { InfoPopover } from "@/components/Overlays/Popover/InfoPopover";`, filename: screen, options, errors: [{ messageId: "shelfInner" }] },
      { code: `import type { P } from "@/components/Overlays/Popover/types";`, filename: screen, options, errors: [{ messageId: "shelfInner" }], name: "型も" },
      { code: `import { x } from "./Popover/InfoPopover";`, filename: at("src/components/Overlays/Modal.tsx"), options, errors: [{ messageId: "shelfInner" }], name: "同じ分類の別の単位から相対で" },
      { code: `export * from "src/components/Overlays/Popover/InfoPopover";`, filename: screen, options, errors: [{ messageId: "shelfInner" }] },
      { code: `const m = await import("@/components/Overlays/Popover/InfoPopover");`, filename: screen, options, errors: [{ messageId: "shelfInner" }] },
      { code: `import { x } from "@/components/Input/__fixtures__/data";`, filename: screen, options, errors: [{ messageId: "shelfInner" }], name: "テストでなければ __fixtures__ も単位" },
    ],
  });
});

test("entry/only-entries(core の部品): 入口だけ。値も型も、core/ を省いた別名も相対も", () => {
  const screen = at("src/app/x/_components/A.tsx");
  ruleTester.run("entry/only-entries", entryPlugin.rules["only-entries"], {
    valid: [
      { code: 'import { WalletBalance } from "@/features/core/wallet/components/WalletBalance";', filename: screen, options },
      { code: 'import { WalletBalance } from "@/features/wallet/components/WalletBalance";', filename: screen, options },
      { code: 'import { Row } from "@/features/core/wallet/components/common/Row";', filename: screen, options },
      { code: 'import { Card } from "./Card";', filename: at(`${C}/WalletBalance/index.tsx`), options },
      { code: 'import { Card } from "../Card";', filename: at(`${C}/WalletBalance/a/b.tsx`), options },
      { code: 'import { renderer } from "@/features/core/milestone/components/renderers/x.child";', filename: at("src/features/core/milestone/extensions/renderers.ts"), options, name: "生成された一覧" },
      { code: 'import { B } from "@/features/gacha/components/A/B";', filename: screen, options, name: "core の外" },
    ],
    invalid: [
      { code: 'import { Card } from "@/features/core/wallet/components/WalletBalance/Card";', filename: screen, options, errors: [{ messageId: "coreInner" }] },
      { code: 'import type { Props } from "@/features/core/wallet/components/WalletBalance/Card";', filename: screen, options, errors: [{ messageId: "coreInner" }], name: "型も" },
      { code: 'import { Card } from "@/features/wallet/components/WalletBalance/Card";', filename: screen, options, errors: [{ messageId: "coreInner" }] },
      { code: 'import { Cell } from "@/features/wallet/components/common/Row/Cell";', filename: screen, options, errors: [{ messageId: "coreInner" }] },
      { code: 'import { Card } from "../WalletBalance/Card";', filename: at(`${C}/WalletPurchase/index.tsx`), options, errors: [{ messageId: "coreInner" }] },
      { code: 'export * from "@/features/wallet/components/WalletBalance/Card";', filename: at("src/app/x/_components/barrel.ts"), options, errors: [{ messageId: "coreInner" }] },
      { code: 'const X = () => import("@/features/wallet/components/WalletBalance/Card");', filename: screen, options, errors: [{ messageId: "coreInner" }] },
    ],
  });
});
