// .notices/20261121-153726-cc-prep.force-dynamic.mjs のテスト。実行: pnpm test .notices (node:test)
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { TARGET, rewrite } from "./20261121-153726-cc-prep.force-dynamic.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "20261121-153726-cc-prep.force-dynamic.mjs");
const dirs = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

test("rewrite: force-dynamic の行だけ消し、空行が 2 つ続かないように詰める", () => {
  const src = `// 頭のコメント\nexport const dynamic = "force-dynamic";\n\nexport { XScreen as default } from "./_screen/XScreen";\n`;
  const r = rewrite(src);
  assert.deepEqual(r.removed, [2]);
  assert.equal(r.text, `// 頭のコメント\n\nexport { XScreen as default } from "./_screen/XScreen";\n`);

  const between = `import a from "a";\n\nexport const dynamic = 'force-dynamic'\n\nexport const x = 1;\n`;
  assert.equal(rewrite(between).text, `import a from "a";\n\nexport const x = 1;\n`);

  const top = `export const dynamic = "force-dynamic";\n\nexport { X as default } from "./_screen/X";\n`;
  assert.equal(rewrite(top).text, `export { X as default } from "./_screen/X";\n`);
});

test("rewrite: 別の値・別の名は消さずに止める、force-dynamic が無ければ何もしない", () => {
  const src = [
    `export const dynamic = "force-static";`,
    `export const revalidate = 60;`,
    `export let dynamicParams = false;`,
    `export const runtime = "nodejs";`,
    `export const fetchCache = "force-no-store";`,
    `export { d as dynamic };`,
    `export const maxDuration = 300;`,
    `export const preferredRegion = "hnd1";`,
    "",
  ].join("\n");
  const r = rewrite(src);
  assert.deepEqual(r.removed, []);
  assert.equal(r.text, src);
  assert.deepEqual(r.stopped.map((s) => s.line), [1, 2, 3, 4, 5, 6]);
});

test("TARGET: src/app の page・layout・route だけ", () => {
  assert.ok(TARGET.test("src/app/page.tsx"));
  assert.ok(TARGET.test("src/app/(user)/a/[id]/page.tsx"));
  assert.ok(TARGET.test("src/app/admin/layout.tsx"));
  assert.ok(TARGET.test("src/app/api/x/route.ts"));
  assert.ok(!TARGET.test("src/app/(user)/a/_screen/AScreen.tsx"));
  assert.ok(!TARGET.test("src/features/x/page.tsx"));
});

test("CLI: dry-run は書かず、--apply で消し、2 回目は変更 0", () => {
  const root = mkdtempSync(join(tmpdir(), "force-dynamic-"));
  dirs.push(root);
  const page = join(root, "src/app/(user)/a/page.tsx");
  const other = join(root, "src/app/(user)/b/page.tsx");
  mkdirSync(dirname(page), { recursive: true });
  mkdirSync(dirname(other), { recursive: true });
  const before = `export const dynamic = "force-dynamic";\n\nexport { AScreen as default } from "./_screen/AScreen";\n`;
  writeFileSync(page, before);
  writeFileSync(other, `export const revalidate = 60;\nexport { BScreen as default } from "./_screen/BScreen";\n`);
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["add", "-A"], { cwd: root });

  const dry = spawnSync(process.execPath, [SCRIPT], { cwd: root, encoding: "utf8" });
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /変更 1 行 \/ 止めた 1 行/);
  assert.equal(readFileSync(page, "utf8"), before, "dry-run は書かない");

  const run = spawnSync(process.execPath, [SCRIPT, "--apply"], { cwd: root, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(readFileSync(page, "utf8"), `export { AScreen as default } from "./_screen/AScreen";\n`);

  const again = spawnSync(process.execPath, [SCRIPT], { cwd: root, encoding: "utf8" });
  assert.match(again.stdout, /変更 0 行 \/ 止めた 1 行/);

  const bad = spawnSync(process.execPath, [SCRIPT, "--force"], { cwd: root, encoding: "utf8" });
  assert.equal(bad.status, 2);
});
