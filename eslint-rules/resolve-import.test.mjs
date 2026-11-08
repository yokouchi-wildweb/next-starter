// eslint-rules/resolve-import.test.mjs
// lint の別名解決(resolve-import.mjs)が本物の tsconfig.json の paths で "@lib-config/<名前>" を解くこと(指令 24 d4)。
// 実行: pnpm test eslint-rules/resolve-import.test.mjs
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveImport } from "./resolve-import.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inToast = path.join(repo, "src/lib/toast/index.ts");

test("@lib-config/<名前> → src/config/lib/<名前>.config.ts", () => {
  assert.equal(resolveImport("@lib-config/toast", inToast, repo), "src/config/lib/toast.config.ts");
  assert.equal(resolveImport("@lib-config/cn", path.join(repo, "src/app/page.tsx"), repo), "src/config/lib/cn.config.ts");
});

test("@lib-config の * は 1 か所で、残りをそのまま差し込む", () => {
  assert.equal(resolveImport("@lib-config/a/b", inToast, repo), "src/config/lib/a/b.config.ts");
});

test("@/ の別名は今のまま(@lib-config/ の行は @/ に当たらない)", () => {
  assert.equal(resolveImport("@/lib/cn", inToast, repo), "src/lib/cn");
  assert.equal(resolveImport("@/features/user/x", inToast, repo), "src/features/core/user/x");
  assert.equal(resolveImport("@/config/lib/toast.config", inToast, repo), "src/config/lib/toast.config");
});
