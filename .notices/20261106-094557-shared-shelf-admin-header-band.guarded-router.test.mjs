// 実行: pnpm test:codemods
// 守り付きの router へ移す道具(./guarded-router.mjs)の書き換え
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { planGuardedRouter, rewriteRouterImport } from "./20261106-094557-shared-shelf-admin-header-band.guarded-router.mjs";

test("useRouter だけを外して守りの lib から足す(ほかの名前は next/navigation に残す、別名も保つ)", () => {
  assert.equal(
    rewriteRouterImport("src/features/x/A.tsx", `"use client";\nimport { useRouter } from "next/navigation";\nconst r = useRouter();\n`).text,
    `"use client";\nimport { useRouter } from "@/lib/unsavedGuard";\nconst r = useRouter();\n`,
  );
  assert.equal(
    rewriteRouterImport("src/app/x/_screen/B.tsx", `import { usePathname, useRouter, useSearchParams } from "next/navigation";\n`).text,
    `import { usePathname, useSearchParams } from "next/navigation";\nimport { useRouter } from "@/lib/unsavedGuard";\n`,
  );
  assert.equal(
    rewriteRouterImport("src/lib/crud/x.ts", `import { useRouter as useNav } from "next/navigation";\n`).text,
    `import { useRouter as useNav } from "@/lib/unsavedGuard";\n`,
  );
});

test("棚(src/components)は lib を読まない: 棚の Navigation の口の useShelfRouter を同じ名前で読む", () => {
  assert.equal(
    rewriteRouterImport("src/components/Navigation/Pagination.tsx", `import { usePathname, useRouter } from "next/navigation";\n`).text,
    `import { usePathname } from "next/navigation";\nimport { useShelfRouter as useRouter } from "@/components/Navigation/NavigationPort";\n`,
  );
});

test("触らない: 守りの lib の中・型だけ・useRouter の無い import・別のモジュール", () => {
  assert.equal(rewriteRouterImport("src/lib/unsavedGuard/UnsavedGuardProvider.tsx", `import { useRouter } from "next/navigation";\n`), null);
  assert.equal(rewriteRouterImport("src/features/x/A.tsx", `import type { useRouter } from "next/navigation";\n`), null);
  assert.equal(rewriteRouterImport("src/features/x/A.tsx", `import { usePathname } from "next/navigation";\n`), null);
  assert.equal(rewriteRouterImport("src/features/x/A.tsx", `import { useRouter } from "@/lib/unsavedGuard";\n`), null);
});

test("リポ全体: テストは触らず、もう一度走らせても変わらない", () => {
  const root = mkdtempSync(join(tmpdir(), "guarded-router-"));
  try {
    const put = (path, text) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    };
    put("src/features/x/A.tsx", `import { useRouter } from "next/navigation";\n`);
    put("src/features/x/A.test.tsx", `import { useRouter } from "next/navigation";\n`);
    const first = planGuardedRouter(root);
    assert.deepEqual(first.changes.map((c) => c.path), ["src/features/x/A.tsx"]);
    for (const c of first.changes) writeFileSync(join(root, c.path), c.text);
    assert.deepEqual(planGuardedRouter(root).changes, []);
    assert.match(readFileSync(join(root, "src/features/x/A.tsx"), "utf8"), /@\/lib\/unsavedGuard/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
