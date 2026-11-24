// .notices/20261124-220900-cc-dev-instant.guard-boundary.test.mjs
// 実行: pnpm test .notices

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { rewriteGuardFile, rewriteRangeLayout, run } from "./20261124-220900-cc-dev-instant.guard-boundary.mjs";

const OLD_ROOT_GUARD = `import "server-only";
import { defineRootGuard } from "@/wiring/pageGuard";

export const { guard, createLoader, guardMetadata, extend } = defineRootGuard({ access: "public" });
`;
const oldChildGuard = (policy) => `import "server-only";
import { extend as extendRoot } from "@/app/guard";

export const { guard, createLoader, guardMetadata, extend } = extendRoot(${policy});
`;
const OLD_LAYOUT = `import type { ReactNode } from "react";

import { guard, guardMetadata } from "./guard";

export const generateMetadata = guardMetadata();

export default async function ShopLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await guard();

  return <>{children}</>;
}
`;
const page = (name) => `export { ${name} as default } from "./_screen/${name}";\n`;

function tree(files) {
  const root = mkdtempSync(join(tmpdir(), "guard-boundary-"));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
}

test("rewriteGuardFile: 古い書き出しを { Guard, … } に、新しい形は null", () => {
  const next = rewriteGuardFile(OLD_ROOT_GUARD);
  assert.match(next, /export const \{ Guard, createLoader, guardMetadata, extend \} = defineRootGuard/);
  assert.equal(rewriteGuardFile(next), null);
});

test("rewriteRangeLayout: return だけの形を Guard で包み、async と await guard() を外す", () => {
  const { text } = rewriteRangeLayout(OLD_LAYOUT);
  assert.doesNotMatch(text, /await guard|async function/);
  assert.match(text, /import \{ Guard, guardMetadata \} from "\.\/guard";\nimport Loading from "\.\/loading";/);
  assert.match(text, /return <Guard fallback=\{<Loading \/>\}>\{children\}<\/Guard>;/);
  assert.equal(rewriteRangeLayout(text), null);
});

test("rewriteRangeLayout: 部品を返す形は括弧つきで包む", () => {
  const src = OLD_LAYOUT.replace("return <>{children}</>;", "return (\n    <ShopFrame>\n      {children}\n    </ShopFrame>\n  );");
  const { text } = rewriteRangeLayout(src);
  assert.match(text, /<Guard fallback=\{<Loading \/>\}>\n      <ShopFrame>\n        \{children\}\n      <\/ShopFrame>\n    <\/Guard>/);
});

test("rewriteRangeLayout: 頭に別の文・別名・Loading の名前があれば止める", () => {
  assert.ok("stop" in rewriteRangeLayout(OLD_LAYOUT.replace("await guard();", "await guard();\n  const x = await load();")));
  assert.ok("stop" in rewriteRangeLayout(OLD_LAYOUT.replace("{ guard, guardMetadata }", "{ guard as rangeGuard, guardMetadata }")));
  assert.ok("stop" in rewriteRangeLayout(OLD_LAYOUT.replace("import type", 'import Loading from "x";\nimport type')));
});

test("run: guard.ts・範囲の layout・共有される段の loading を書き、2 回目は 0 件、公開の範囲は触らない", () => {
  const root = tree({
    "src/app/guard.ts": OLD_ROOT_GUARD,
    "src/app/page.tsx": page("TopScreen"),
    "src/app/blog/page.tsx": page("BlogScreen"),
    "src/app/blog/[slug]/page.tsx": page("PostScreen"),
    "src/app/shop/guard.ts": oldChildGuard(`{ access: "authenticated", redirectTo: "/login" }`),
    "src/app/shop/layout.tsx": OLD_LAYOUT,
    "src/app/shop/page.tsx": page("ShopScreen"),
    "src/app/shop/orders/page.tsx": page("OrdersScreen"),
    "src/app/shop/orders/[id]/page.tsx": page("OrderScreen"),
  });
  try {
    const first = run(root, { apply: true });
    assert.deepEqual(first.stops, []);
    assert.deepEqual(
      first.changes.map((c) => `${c.kind} ${c.file}`).sort(),
      [
        "guard src/app/guard.ts",
        "guard src/app/shop/guard.ts",
        "layout src/app/shop/layout.tsx",
        "loading src/app/shop/loading.tsx",
        "loading src/app/shop/orders/loading.tsx",
      ],
    );
    assert.match(readFileSync(join(root, "src/app/shop/loading.tsx"), "utf8"), /bg-transparent/);
    assert.equal(existsSync(join(root, "src/app/blog/loading.tsx")), false, "公開の範囲は求めない");
    assert.deepEqual(run(root, { apply: true }).changes, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
