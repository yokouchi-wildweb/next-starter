// .notices/20261119-222756-context-after-v2.functional-folder.test.mjs
// codemod functional-folder: 指定の書き換え・fork のファイルの移動・止める場合・何度走らせても同じ
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { apply, plan, rewriteSpecifier, rewriteSource } from "./20261119-222756-context-after-v2.functional-folder.mjs";

const repo = (files) => {
  const root = mkdtempSync(path.join(tmpdir(), "functional-folder-"));
  execFileSync("git", ["init", "-q"], { cwd: root });
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  }
  execFileSync("git", ["add", "-A"], { cwd: root });
  return root;
};

test("指定: @/ と相対で Fanctional を指すものだけ Functional に、ほかは触らない", () => {
  assert.equal(rewriteSpecifier("src/app/x.tsx", "@/components/Fanctional/BodyPortal"), "@/components/Functional/BodyPortal");
  assert.equal(rewriteSpecifier("src/app/x.tsx", "@/components/Fanctional"), "@/components/Functional");
  assert.equal(rewriteSpecifier("src/components/Form/x.tsx", "../Fanctional/HeadPortal"), "../Functional/HeadPortal");
  assert.equal(rewriteSpecifier("src/app/x.tsx", "@/components/Functional/BodyPortal"), null);
  assert.equal(rewriteSpecifier("src/app/x.tsx", "@/lib/Fanctional"), null);
  assert.equal(rewriteSpecifier("src/app/x.tsx", "fanctional-pkg"), null);
});

test("中身: import・export・import()・mock.module の文字列を書き換え、地の文は触らない", () => {
  const src = [
    'import { BodyPortal } from "@/components/Fanctional/BodyPortal";',
    "export { HeadPortal } from '@/components/Fanctional/HeadPortal';",
    'const m = await import("@/components/Fanctional/DarkModeSwitch");',
    'mock.module("@/components/Fanctional/DarkModeSwitch", {});',
    "// Fanctional の頃のメモ",
  ].join("\n");
  const { text, hits } = rewriteSource("src/app/x.tsx", src);
  assert.equal(hits.length, 4);
  assert.equal((text.match(/Functional/g) ?? []).length, 4);
  assert.ok(text.includes("// Fanctional の頃のメモ"));
});

test("plan と apply: 書き換え・fork のファイルの移動・文書は一覧だけ、2 回目は変えるものなし", () => {
  const root = repo({
    "src/app/page.tsx": 'import { BodyPortal } from "@/components/Fanctional/BodyPortal";\n',
    "src/components/Fanctional/ForkThing.tsx": 'import { HeadPortal } from "../Functional/HeadPortal";\n',
    "src/components/Functional/HeadPortal.tsx": "export const HeadPortal = 1;\n",
    "src/features/shop/README.md": "Fanctional/BodyPortal を使う\n",
  });
  const first = plan(root);
  assert.deepEqual(first.rewrites.map((r) => r.file), ["src/app/page.tsx"]);
  assert.deepEqual(first.moves, [{ from: "src/components/Fanctional/ForkThing.tsx", to: "src/components/Functional/ForkThing.tsx" }]);
  assert.deepEqual(first.docs, ["src/features/shop/README.md"]);
  apply(root, first);
  assert.ok(readFileSync(path.join(root, "src/app/page.tsx"), "utf8").includes("@/components/Functional/BodyPortal"));
  assert.ok(existsSync(path.join(root, "src/components/Functional/ForkThing.tsx")));
  assert.ok(!existsSync(path.join(root, "src/components/Fanctional/ForkThing.tsx")));
  const second = plan(root);
  assert.equal(second.rewrites.length + second.moves.length + second.clashes.length, 0);
});

test("行き先に同じ名があれば動かさず止める一覧に出す", () => {
  const root = repo({
    "src/components/Fanctional/BodyPortal.tsx": "export const BodyPortal = 'fork';\n",
    "src/components/Functional/BodyPortal.tsx": "export const BodyPortal = 'upstream';\n",
  });
  const result = plan(root);
  assert.deepEqual(result.clashes, [{ from: "src/components/Fanctional/BodyPortal.tsx", to: "src/components/Functional/BodyPortal.tsx" }]);
  assert.deepEqual(result.moves, []);
});
