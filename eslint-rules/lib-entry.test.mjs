// eslint-rules/lib-entry.test.mjs
// lib の入口の lint(import-boundaries の lib-entry・lib-self-relative)の契約テスト。
// fixture の repo は一時フォルダに作り、規則の option root でそこを読ませる(src の下に置かない)。
// 実行: pnpm test eslint-rules/lib-entry.test.mjs (node:test)
import { test, after } from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { RuleTester } from "eslint";

import plugin from "./import-boundaries.mjs";

const tsParser = createRequire(import.meta.resolve("eslint-config-next"))("@typescript-eslint/parser");
const root = mkdtempSync(path.join(tmpdir(), "lib-entry-"));
after(() => rmSync(root, { recursive: true, force: true }));

function write(rel, content) {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content, null, 2));
}

write("tsconfig.json", { compilerOptions: { paths: { "@/*": ["./src/*"] } } });
// toastlike: 宣言済み(入口 . と ./useToast)。cn を読み、棚 components を peer に持つ
write("src/lib/toastlike/package.json", {
  exports: { ".": "./index.ts", "./useToast": "./useToast.ts" },
  libs: ["cn", "plain"],
  peers: ["components"],
});
for (const file of ["index.ts", "useToast.ts", "inner/store.ts"]) write(`src/lib/toastlike/${file}`, "export {};\n");
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

test("rule lib-entry: 外から宣言済みの lib は exports の入口だけ(別名・相対・\"src/…\"・dynamic・require・型も実パスで照合)", () => {
  ruleTester.run("lib-entry", plugin.rules["lib-entry"], {
    valid: [
      { code: `import { useToast } from "@/lib/toastlike";`, filename: outside, options },
      { code: `import { useToast } from "@/lib/toastlike/useToast";`, filename: outside, options },
      { code: `import { x } from "@/lib/toastlike/index";`, filename: outside, options },
      { code: `import { x } from "../../../lib/toastlike/useToast.ts";`, filename: outside, options },
      { code: `import { x } from "src/lib/toastlike";`, filename: outside, options },
      { code: `const m = await import("@/lib/toastlike/useToast");`, filename: outside, options },
      { code: `import { x } from "@/lib/plain/deep";`, filename: outside, options, name: "宣言の無い lib の中は見ない(L1.21)" },
      { code: `import { x } from "@/lib/toastlike";`, filename: at("scripts/tool/run.mjs"), options },
      { code: `import { x } from "react"; import fs from "node:fs";`, filename: outside, options },
    ],
    invalid: [
      { code: `import { store } from "@/lib/toastlike/inner/store";`, filename: outside, options, errors: [{ messageId: "innerImport" }] },
      { code: `import type { Store } from "@/lib/toastlike/inner/store";`, filename: outside, options, errors: [{ messageId: "innerImport" }] },
      { code: `import { store } from "../../../lib/toastlike/inner/store";`, filename: outside, options, errors: [{ messageId: "innerImport" }] },
      { code: `import { store } from "src/lib/toastlike/inner/store.ts";`, filename: outside, options, errors: [{ messageId: "innerImport" }] },
      { code: `const m = await import("@/lib/toastlike/inner/store");`, filename: outside, options, errors: [{ messageId: "innerImport" }] },
      { code: `const m = require("@/lib/toastlike/inner/store");`, filename: outside, options, errors: [{ messageId: "innerImport" }] },
      { code: `export { store } from "@/lib/toastlike/inner/store";`, filename: outside, options, errors: [{ messageId: "innerImport" }] },
      { code: `export * from "@/lib/cn/groups";`, filename: outside, options, errors: [{ messageId: "innerImport" }] },
      {
        code: `import { x } from "@/lib/cn/groups";`,
        filename: at("scripts/tool/run.test.mjs"),
        options,
        errors: [{ messageId: "innerImport" }],
        name: "scripts・テストからの読みも対象(D84)",
      },
      {
        code: `import { x } from "@/lib/cn/groups";`,
        filename: inPlain,
        options,
        errors: [{ messageId: "innerImport" }],
        name: "宣言の無い lib から読むときも相手の入口は守る",
      },
    ],
  });
});

test("rule lib-entry: 宣言済みの lib は宣言した lib の入口・peers の棚・@lib-config/<自分> だけを読む", () => {
  ruleTester.run("lib-entry", plugin.rules["lib-entry"], {
    valid: [
      { code: `import { cn } from "@/lib/cn";`, filename: inToast, options },
      { code: `import { x } from "@/lib/plain/deep";`, filename: inToast, options, name: "宣言した相手が未宣言なら入口の照合はしない" },
      { code: `import { Button } from "@/components/Form/Button";`, filename: inToast, options },
      { code: `import config from "@lib-config/toastlike";`, filename: inToast, options },
      { code: `import { x } from "../useToast"; import { y } from "./other";`, filename: inToast, options },
      { code: `import { create } from "zustand";`, filename: inToast, options },
      { code: `import { x } from "@/hooks/useIsClient";`, filename: inPlain, options, name: "宣言の無い lib の読みは見ない(L1.21)" },
    ],
    invalid: [
      { code: `import { x } from "@/lib/other";`, filename: inToast, options, errors: [{ messageId: "undeclaredLib" }] },
      { code: `import type { X } from "../../other";`, filename: inToast, options, errors: [{ messageId: "undeclaredLib" }] },
      { code: `import { x } from "@/lib/cn/groups";`, filename: inToast, options, errors: [{ messageId: "innerImport" }] },
      { code: `import { x } from "@/hooks/useIsClient";`, filename: inToast, options, errors: [{ messageId: "undeclaredPath" }] },
      { code: `import { x } from "@/features/user/hooks";`, filename: inToast, options, errors: [{ messageId: "undeclaredPath" }] },
      { code: `import { x } from "@/config/ui/fonts.config";`, filename: inToast, options, errors: [{ messageId: "undeclaredPath" }] },
      { code: `import c from "@/config/lib/toastlike.config";`, filename: inToast, options, errors: [{ messageId: "undeclaredPath" }] },
      { code: `import c from "src/config/lib/toastlike.config";`, filename: inToast, options, errors: [{ messageId: "undeclaredPath" }] },
      { code: `import c from "@lib-config/cn";`, filename: inToast, options, errors: [{ messageId: "libConfigOther" }] },
      { code: `import c from "@lib-config/toastlike/extra";`, filename: inToast, options, errors: [{ messageId: "libConfigOther" }] },
    ],
  });
});

test("rule lib-self-relative: 宣言済みの lib の中で自分を別名で読むと error、相対と宣言の無い lib は通す", () => {
  ruleTester.run("lib-self-relative", plugin.rules["lib-self-relative"], {
    valid: [
      { code: `import { x } from "../useToast";`, filename: inToast, options },
      { code: `import { cn } from "@/lib/cn";`, filename: inToast, options },
      { code: `import { x } from "@/lib/plain/deep";`, filename: inPlain, options, name: "宣言の無い lib は見ない(L1.21)" },
      { code: `import { x } from "@/lib/toastlike";`, filename: outside, options },
    ],
    invalid: [
      { code: `import { x } from "@/lib/toastlike/useToast";`, filename: inToast, options, errors: [{ messageId: "selfAlias" }] },
      { code: `import { x } from "@/lib/toastlike";`, filename: inToast, options, errors: [{ messageId: "selfAlias" }] },
      { code: `import type { X } from "src/lib/toastlike/index";`, filename: inToast, options, errors: [{ messageId: "selfAlias" }] },
      { code: `const m = await import("@/lib/toastlike/inner/store");`, filename: inToast, options, errors: [{ messageId: "selfAlias" }] },
    ],
  });
});
