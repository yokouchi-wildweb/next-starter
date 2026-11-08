// scripts/structure/lib-package/codemod.test.mjs
// 閉じた lib の中を読む import を入口へ書き換える codemod の契約テスト。fixture の repo は一時フォルダに作る。
// 実行: pnpm test scripts/structure/lib-package/codemod.test.mjs (node:test)
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { clearLibPackageCache } from "../../../src/lib/libPackage/index.mjs";
import { entryForFile, entryIndex, planCodemod, runCodemod } from "./codemod.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const roots = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function makeRepo(files) {
  const root = mkdtempSync(path.join(tmpdir(), "lib-codemod-"));
  roots.push(root);
  const all = { "tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }), ...files };
  for (const [rel, content] of Object.entries(all)) {
    const file = path.join(root, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content));
  }
  clearLibPackageCache();
  return root;
}

/** 閉じた lib "box"(入口 "." と "./server")+ 宣言の無い lib "loose" */
const BOX = {
  "src/lib/box/package.json": { exports: { ".": "./index.ts", "./server": "./server.ts" } },
  "src/lib/box/index.ts": [
    'export { useBox } from "./hooks/useBox";',
    'export * from "./types";',
    'export { boxColor as color } from "./theme";',
    'import { Shelf } from "./parts/Shelf";',
    "export { Shelf };",
    'export * as boxUtils from "./utils";',
    "",
  ].join("\n"),
  "src/lib/box/server.ts": 'export { readBox } from "./internal/read";\n',
  "src/lib/box/hooks/useBox.ts": "export function useBox() { return 1; }\nexport const hidden = 2;\n",
  "src/lib/box/types.ts": "export type BoxSize = 'sm' | 'lg';\nexport interface BoxProps { size: BoxSize }\n",
  "src/lib/box/theme.ts": "export const boxColor = 'red';\n",
  "src/lib/box/parts/Shelf.tsx": "export function Shelf() { return null; }\nexport default Shelf;\n",
  "src/lib/box/utils.ts": "export const u = 1;\n",
  "src/lib/box/internal/read.ts": "export async function readBox() { return 1; }\n",
  "src/lib/loose/index.ts": "export const x = 1;\n",
  "src/lib/loose/deep.ts": "export const y = 1;\n",
};

test("entryIndex: 入口の名前を export の連なり(from・*・import した名前・別名・名前空間)から求める", () => {
  const root = makeRepo(BOX);
  const rows = entryIndex(root, "box").map((r) => `${r.key} ${r.name} <- ${r.origin.file}#${r.origin.name}`);
  assert.deepEqual(rows.sort(), [
    ". BoxProps <- src/lib/box/types.ts#BoxProps",
    ". BoxSize <- src/lib/box/types.ts#BoxSize",
    ". Shelf <- src/lib/box/parts/Shelf.tsx#Shelf",
    ". boxUtils <- src/lib/box/utils.ts#*",
    ". color <- src/lib/box/theme.ts#boxColor",
    ". useBox <- src/lib/box/hooks/useBox.ts#useBox",
    "./server readBox <- src/lib/box/internal/read.ts#readBox",
  ]);
});

test("entryForFile: 中のファイル → その物を出す入口の鍵(拡張子の有無を問わない)、出ていなければ null", () => {
  const root = makeRepo(BOX);
  assert.equal(entryForFile(root, "box", "src/lib/box/hooks/useBox.ts"), ".");
  assert.equal(entryForFile(root, "box", "src/lib/box/hooks/useBox"), ".");
  assert.equal(entryForFile(root, "box", "src/lib/box/internal/read.ts"), "./server");
  assert.equal(entryForFile(root, "box", "src/lib/box/index.ts"), ".");
  assert.equal(entryForFile(root, "box", "src/lib/box/server"), "./server");
  assert.equal(entryForFile(root, "box", "src/lib/box/nope.ts"), null);
  assert.equal(entryForFile(root, "loose", "src/lib/loose/deep.ts"), null, "宣言の無い lib は答えない");
});

test("書き換え: 名前つき・type・名前ごとの type・re-export・別名・相対・入口ごとの分割", () => {
  const root = makeRepo({
    ...BOX,
    "src/features/a/A.tsx": [
      'import { useBox } from "@/lib/box/hooks/useBox";',
      'import type { BoxSize } from "@/lib/box/types";',
      'import { type BoxProps } from "../../lib/box/types";',
      'import { boxColor } from "@/lib/box/theme";',
      'import { useBox as use, } from "src/lib/box/hooks/useBox.ts";',
      "",
    ].join("\n"),
    "src/features/a/index.ts": 'export { Shelf } from "@/lib/box/parts/Shelf";\nexport type { BoxSize as Size } from "@/lib/box/types";\n',
    "src/features/a/mixed.ts": '  import { useBox } from "@/lib/box/hooks/useBox"; import { readBox } from "@/lib/box/internal/read";\n',
    "scripts/tool.mjs": 'import { readBox } from "../src/lib/box/internal/read";\n',
    "src/lib/box/hooks/inside.ts": 'import { boxColor } from "../theme";\n',
    "src/lib/other/index.ts": 'import { useBox } from "@/lib/box/hooks/useBox";\nexport const z = useBox;\n',
    "src/features/b/B.ts": 'import { y } from "@/lib/loose/deep";\nimport { useBox } from "@/lib/box";\n',
    "src/lib/box/all.ts": 'export { useBox } from "./hooks/useBox";\nexport { readBox } from "./internal/read";\n',
    "src/features/e/E.ts": '\timport { useBox, readBox as rb } from "@/lib/box/all";\n',
  });
  const plan = planCodemod(root);
  assert.deepEqual(plan.stops, []);
  const out = plan.changes.map((c) => `${c.file}:${c.line} ${c.text}`).sort();
  assert.deepEqual(out, [
    'scripts/tool.mjs:1 import { readBox } from "@/lib/box/server";',
    'src/features/a/A.tsx:1 import { useBox } from "@/lib/box";',
    'src/features/a/A.tsx:2 import type { BoxSize } from "@/lib/box";',
    'src/features/a/A.tsx:3 import { type BoxProps } from "@/lib/box";',
    'src/features/a/A.tsx:4 import { color as boxColor } from "@/lib/box";',
    'src/features/a/A.tsx:5 import { useBox as use } from "@/lib/box";',
    'src/features/a/index.ts:1 export { Shelf } from "@/lib/box";',
    'src/features/a/index.ts:2 export type { BoxSize as Size } from "@/lib/box";',
    'src/features/a/mixed.ts:1 import { readBox } from "@/lib/box/server";',
    'src/features/a/mixed.ts:1 import { useBox } from "@/lib/box";',
    'src/features/e/E.ts:1 import { useBox } from "@/lib/box";\n\timport { readBox as rb } from "@/lib/box/server";',
    'src/lib/other/index.ts:1 import { useBox } from "@/lib/box";',
  ]);
});

test("止まる一覧: default・namespace・export *・副作用・動的・require・入口に無い名前(文は丸ごと)", () => {
  const root = makeRepo({
    ...BOX,
    "src/features/c/C.tsx": [
      'import Shelf from "@/lib/box/parts/Shelf";',
      'import * as theme from "@/lib/box/theme";',
      'export * from "@/lib/box/theme";',
      'export * as t from "@/lib/box/theme";',
      'import "@/lib/box/utils";',
      'const m = await import("@/lib/box/hooks/useBox");',
      'const r = require("@/lib/box/theme");',
      'import { useBox, hidden } from "@/lib/box/hooks/useBox";',
      'import { gone } from "@/lib/box/missing";',
      "",
    ].join("\n"),
  });
  const plan = planCodemod(root);
  assert.deepEqual(plan.changes, []);
  assert.deepEqual(
    plan.stops.map((s) => `${s.line} ${s.kind}`),
    ["1 default", "2 namespace", "3 exportAll", "4 exportAll", "5 sideEffect", "6 dynamic", "7 dynamic", "8 notExported", "9 unparsable"],
  );
  assert.match(plan.stops[7].detail, /hidden/);
});

test("runCodemod: dry-run は書かず、--apply で書き、もう一度回すと 0。--json の形、知らない引数は 2", () => {
  const source = 'import { useBox } from "@/lib/box/hooks/useBox";\nexport const a = useBox;\n';
  const root = makeRepo({ ...BOX, "src/features/d/D.ts": source });
  const lines = [];
  const stdout = { write: (s) => lines.push(s) };
  assert.equal(runCodemod(root, [], { stdout }), 0);
  assert.equal(readFileSync(path.join(root, "src/features/d/D.ts"), "utf8"), source, "dry-run は書かない");
  assert.match(lines.join(""), /dry-run/);

  lines.length = 0;
  assert.equal(runCodemod(root, ["--apply", "--json"], { stdout }), 0);
  const json = JSON.parse(lines.join(""));
  assert.equal(json.apply, true);
  assert.deepEqual(Object.keys(json.changes[0]).sort(), ["file", "from", "line", "names", "text", "to"]);
  assert.deepEqual(json.stops, []);
  assert.equal(readFileSync(path.join(root, "src/features/d/D.ts"), "utf8"), 'import { useBox } from "@/lib/box";\nexport const a = useBox;\n');
  assert.equal(planCodemod(root).changes.length, 0, "2 回目は 0");

  assert.equal(runCodemod(root, ["--bogus"], { stdout }), 2);
});

test("閉じた lib が無い repo では何もしない", () => {
  const root = makeRepo({ "src/lib/loose/index.ts": "export {};\n", "src/a.ts": 'import { y } from "@/lib/loose/deep";\n' });
  assert.deepEqual(planCodemod(root), { scanned: 0, rows: [], changes: [], stops: [] });
});

test("上流で回すと書き換え 0(閉じた lib の中を読む import は手で直してある)", () => {
  clearLibPackageCache();
  const plan = planCodemod(repoRoot);
  assert.deepEqual(plan.changes, []);
  assert.ok(plan.scanned > 0);
});

/** git の見本: <base> で src/hooks/useThing.ts、<head> でそれを閉じた lib thing へ移す(呼び手は古い書き方のまま = fork の物) */
function makeMovedRepo() {
  const root = makeRepo({
    "src/hooks/useThing.ts": "export function useThing() { return 1; }\nexport const thingOnly = 1;\n",
    "src/features/f/F.tsx": [
      'import { useThing } from "@/hooks/useThing";',
      'import type { useThing as T } from "../../hooks/useThing";',
      'import { thingOnly } from "@/hooks/useThing";',
      'import useThingDefault from "@/hooks/useThing";',
      'const m = await import("@/hooks/useThing");',
      'import { x } from "@/hooks/other";',
      "",
    ].join("\n"),
    "src/hooks/other.ts": "export const x = 1;\n",
  });
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.test", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.test" } });
  git("init", "-q");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  const base = git("rev-parse", "HEAD").trim();
  mkdirSync(path.join(root, "src/lib/thing"), { recursive: true });
  git("mv", "src/hooks/useThing.ts", "src/lib/thing/useThing.ts");
  writeFileSync(path.join(root, "src/lib/thing/index.ts"), 'export { useThing } from "./useThing";\n');
  writeFileSync(path.join(root, "src/lib/thing/package.json"), JSON.stringify({ exports: { ".": "./index.ts" } }));
  git("add", "-A");
  git("commit", "-q", "-m", "head");
  clearLibPackageCache();
  return { root, base };
}

test("--base: moved の imports: の行(lib の外から閉じた lib へ移ったファイルの古い書き方)も入口へ書き換える", () => {
  const { root, base } = makeMovedRepo();
  const plan = planCodemod(root, { base });
  assert.deepEqual(plan.rows, [{ from: "@/hooks/useThing", to: "@/lib/thing" }]);
  assert.deepEqual(
    plan.changes.map((c) => `${c.line} ${c.text}`),
    ['1 import { useThing } from "@/lib/thing";', '2 import type { useThing as T } from "@/lib/thing";'],
  );
  assert.deepEqual(
    plan.stops.map((s) => `${s.line} ${s.kind}`),
    ["3 notExported", "4 default", "5 dynamic"],
    "入口に無い名前・default・動的は止まる",
  );
});

test("--base なしでは古い指定子は触らない。runCodemod --base で書き、2 回目は 0", () => {
  const { root, base } = makeMovedRepo();
  assert.deepEqual(planCodemod(root).changes, []);
  const lines = [];
  const stdout = { write: (s) => lines.push(s) };
  assert.equal(runCodemod(root, ["--base", base, "--apply"], { stdout }), 0);
  assert.match(lines.join(""), /古い指定子の行 1/);
  assert.match(readFileSync(path.join(root, "src/features/f/F.tsx"), "utf8"), /^import \{ useThing \} from "@\/lib\/thing";/);
  assert.equal(planCodemod(root, { base }).changes.length, 0, "2 回目は 0");
  assert.equal(runCodemod(root, ["--base"], { stdout }), 2, "--base に値が無いと 2");
});
