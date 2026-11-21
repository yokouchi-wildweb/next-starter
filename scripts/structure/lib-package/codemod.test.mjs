// scripts/structure/lib-package/codemod.test.mjs
// 閉じた lib の中を読む import を入口へ書き換える codemod(名前ごとの割り・改名表を含む)の契約テスト。fixture の repo は一時フォルダに作る。
// 実行: pnpm test scripts/structure/lib-package/codemod.test.mjs (node:test)
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { clearLibPackageCache } from "../../../src/lib/libPackage/node.mjs";
import { scanInnerImports } from "./closed.mjs";
import { applyCodemod, entryForFile, entryIndex, planCodemod, runCodemod } from "./codemod.mjs";
import { loadRenames, validateRenames } from "./renames.mjs";

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
    'scripts/tool.mjs:1 import { readBox } from "../src/lib/box/server";',
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

test("JS の入口(.mjs)はファイル名まで書き、JS のファイルの相対の import は相対のまま入口へ", () => {
  const root = makeRepo({
    "src/lib/kase/package.json": { exports: { ".": "./index.mjs" } },
    "src/lib/kase/index.mjs": 'export { toKase } from "./impl.mjs";\n',
    "src/lib/kase/impl.mjs": "export function toKase(s) { return s; }\n",
    "src/features/k/K.ts": 'import { toKase } from "@/lib/kase/impl.mjs";\n',
    "scripts/gen/tool.mjs": 'import { toKase } from "../../src/lib/kase/impl.mjs";\n',
  });
  assert.deepEqual(entryIndex(root, "kase").map((r) => r.specifier), ["@/lib/kase/index.mjs"]);
  const out = planCodemod(root).changes.map((c) => `${c.file} ${c.text}`).sort();
  assert.deepEqual(out, [
    'scripts/gen/tool.mjs import { toKase } from "../../src/lib/kase/index.mjs";',
    'src/features/k/K.ts import { toKase } from "@/lib/kase/index.mjs";',
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

test("出荷済みの notice の道具(.notices/**)は走査しない: 書き換え・止まる一覧・中を読む数のどれにも入らない(D267)", () => {
  const read = 'import { readBox } from "../src/lib/box/internal/read";\n';
  const root = makeRepo({
    ...BOX,
    ".notices/20990101-000000-x.tool.mjs": read,
    ".notices/20990101-000000-x.tool.test.mjs": read,
    "scripts/tool.mjs": read,
  });
  const plan = planCodemod(root);
  assert.deepEqual(plan.changes.map((c) => c.file), ["scripts/tool.mjs"]);
  assert.deepEqual(plan.stops, []);
  assert.deepEqual(scanInnerImports(root).get("box")?.samples.map((s) => s.split(" → ")[0]), ["scripts/tool.mjs"]);
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

/** git の見本: 閉じた lib "s" の束 client/index.ts を、閉じる段で入口 "." にたたんで消す(呼び手は古い書き方のまま = fork の物) */
function makeFoldedRepo() {
  const root = makeRepo({
    "src/lib/s/index.ts": 'export { ref } from "./ref";\n',
    "src/lib/s/ref.ts": "export const ref = 1;\n",
    "src/lib/s/client/index.ts": 'export { upload, type Upload } from "./upload";\n',
    "src/lib/s/client/upload.ts": "export const upload = 1;\nexport type Upload = number;\nexport const notInBarrel = 1;\n",
    "src/lib/s/server/fake.ts": "export const fake = 1;\n",
    "src/features/f/F.tsx": [
      'import { upload, type Upload } from "@/lib/s/client";',
      'import { upload as send } from "@/lib/s/client";',
      'import { notInBarrel } from "@/lib/s/client";',
      "",
    ].join("\n"),
  });
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.test", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.test" } });
  git("init", "-q");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  const base = git("rev-parse", "HEAD").trim();
  git("rm", "-q", "src/lib/s/client/index.ts");
  writeFileSync(path.join(root, "src/lib/s/index.ts"), 'export { ref } from "./ref";\nexport { upload, type Upload } from "./client/upload";\n');
  writeFileSync(path.join(root, "src/lib/s/package.json"), JSON.stringify({ exports: { ".": "./index.ts" } }));
  git("add", "-A");
  git("commit", "-q", "-m", "head");
  clearLibPackageCache();
  return { root, base };
}

test("--base: 閉じる段で消した束(@/lib/s/client)を読む import は、束が出していた名前ごとに今の入口へ書き換える", () => {
  const { root, base } = makeFoldedRepo();
  const plan = planCodemod(root, { base });
  assert.deepEqual(
    plan.changes.map((c) => `${c.line} ${c.text}`),
    ['1 import { upload, type Upload } from "@/lib/s";', '2 import { upload as send } from "@/lib/s";'],
  );
  assert.deepEqual(
    plan.stops.map((s) => `${s.line} ${s.kind}`),
    ["3 notExported"],
    "束が出していなかった名前は止まる",
  );
});

test("--base なしでは消えた束は unparsable で止まり、--base の案内を出す", () => {
  const { root } = makeFoldedRepo();
  const plan = planCodemod(root);
  assert.deepEqual(plan.changes, []);
  assert.deepEqual(
    plan.stops.map((s) => s.kind),
    ["unparsable", "unparsable", "unparsable"],
  );
  assert.match(plan.stops[0].detail, /--base <rev> で名前ごとに引ける/);
});

/** 名前ごとの割り(D262): 入口 "." から出ていった名前(同じ lib の ./server・別の lib)と、決まらない名前 */
const SPLIT = {
  "src/lib/kit/package.json": { exports: { ".": "./index.ts", "./server": "./server.ts" } },
  "src/lib/kit/index.ts": 'export { useKit } from "./useKit";\n',
  "src/lib/kit/useKit.ts": "export function useKit() { return 1; }\n",
  "src/lib/kit/server.ts": 'export { omit } from "./omit";\n',
  "src/lib/kit/omit.ts": "export function omit() { return 1; }\n",
  "src/lib/def/package.json": { exports: { ".": "./index.ts" } },
  "src/lib/def/index.ts": 'export { ID_FIELD, type Paths } from "./fields";\n',
  "src/lib/def/fields.ts": 'export const ID_FIELD = "id";\nexport type Paths = { index: string };\n',
  "src/lib/a1/package.json": { exports: { ".": "./index.ts" } },
  "src/lib/a1/index.ts": "export const twin = 1;\n",
  "src/lib/a2/package.json": { exports: { ".": "./index.ts" } },
  "src/lib/a2/index.ts": "export const twin = 2;\n",
  "src/features/x/X.ts": [
    'import { useKit, omit, ID_FIELD, type Paths } from "@/lib/kit";',
    'import { useKit as k } from "@/lib/kit";',
    'import { twin } from "@/lib/kit";',
    'import { nowhere } from "@/lib/kit";',
    'export { omit } from "@/lib/kit";',
    "",
  ].join("\n"),
};

test("名前ごとの割り: 入口から出ていった名前を、同じ lib の別の入口・それを出す 1 つの入口へ文を分けて書き換える。決まらない・無い名前は止まる", () => {
  const plan = planCodemod(makeRepo(SPLIT), { table: [] });
  assert.deepEqual(
    plan.changes.map((c) => `${c.line} ${c.text}`),
    [
      '1 import { useKit } from "@/lib/kit";\nimport { omit } from "@/lib/kit/server";\nimport { ID_FIELD, type Paths } from "@/lib/def";',
      '5 export { omit } from "@/lib/kit/server";',
    ],
    "名前が全部入口から出ている文(2 行目)は触らない",
  );
  assert.deepEqual(
    plan.stops.map((s) => `${s.line} ${s.kind}`),
    ["3 ambiguous", "4 notExported"],
  );
  assert.match(plan.stops[0].detail, /@\/lib\/a1, @\/lib\/a2/);
});

/** git の見本: <base> で lib st の CONST_A と firestore 側の createCrudService、<head> で CONST_A を lib dom へ移し(同じ名前が lib zz にも)、firestore 側を改名 */
function makeRenamedRepo() {
  const root = makeRepo({
    "src/lib/st/package.json": { exports: { ".": "./index.ts", "./fire": "./fire.ts" } },
    "src/lib/st/index.ts": 'export { createCrudService } from "./drizzle";\nexport { CONST_A } from "./consts";\n',
    "src/lib/st/drizzle.ts": "export function createCrudService() { return 1; }\n",
    "src/lib/st/fire.ts": "export function createCrudService() { return 2; }\n",
    "src/lib/st/consts.ts": "export const CONST_A = 1;\n",
    "src/lib/dom/package.json": { exports: { ".": "./index.ts" } },
    "src/lib/dom/index.ts": "export const other = 1;\n",
    "src/lib/zz/package.json": { exports: { ".": "./index.ts" } },
    "src/lib/zz/index.ts": "export const CONST_A = 9;\n",
    "src/features/b/a.ts": 'import { createCrudService } from "@/lib/st";\nimport { createCrudService as fire } from "@/lib/st/fire";\nimport { CONST_A } from "@/lib/st";\nexport const z = [createCrudService, fire, CONST_A];\n',
  });
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.test", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.test" } });
  git("init", "-q");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  const base = git("rev-parse", "HEAD").trim();
  git("mv", "src/lib/st/consts.ts", "src/lib/dom/consts.ts");
  writeFileSync(path.join(root, "src/lib/st/index.ts"), 'export { createCrudService } from "./drizzle";\n');
  writeFileSync(path.join(root, "src/lib/dom/index.ts"), 'export const other = 1;\nexport { CONST_A } from "./consts";\n');
  writeFileSync(path.join(root, "src/lib/st/fire.ts"), "export function createFirestoreCrudService() { return 2; }\n");
  git("add", "-A");
  git("commit", "-q", "-m", "head");
  clearLibPackageCache();
  return { root, base };
}
const FIRE_ROW = [{ segment: "k5", lib: "st", kind: "export", from: "createCrudService", to: "createFirestoreCrudService", origin: "src/lib/st/fire.ts" }];

test("--base: 出ていった名前は <base> の実体を改名で辿って入口を決め(同じ名前の別物と分ける)、origin の export の行は同じ名前の別物を分けて改名する", () => {
  const { root, base } = makeRenamedRepo();
  const plan = planCodemod(root, { base, table: FIRE_ROW });
  assert.deepEqual(
    plan.changes.map((c) => `${c.line} ${c.text}`),
    ['2 import { createFirestoreCrudService as fire } from "@/lib/st/fire";', '3 import { CONST_A } from "@/lib/dom";'],
    "drizzle 側の createCrudService(1 行目)は触らない",
  );
  assert.deepEqual(plan.stops, []);
});

test("--base なし: origin の行は needsBase、実体が 2 つある名前は ambiguous で止まる", () => {
  const { root } = makeRenamedRepo();
  const plan = planCodemod(root, { table: FIRE_ROW });
  assert.deepEqual(plan.changes, []);
  assert.deepEqual(
    plan.stops.map((s) => `${s.line} ${s.kind}`),
    ["2 needsBase", "3 ambiguous"],
  );
});

/** 改名の後の lib svc(サービスは delete・get、ApiClient は get・delete、型 IdStrategy)と、古い名前のままの読み手 */
const RENAMED_SVC = {
  "src/lib/svc/package.json": { exports: { ".": "./index.ts" } },
  "src/lib/svc/index.ts": 'export { createService, type IdStrategy } from "./service";\nexport { createApiClient, type ApiClient } from "./client";\n',
  "src/lib/svc/service.ts": 'export type IdStrategy = "uuid" | "db";\nexport function createService() { return { async get(id: string) { return id; }, async delete(id: string) {}, async hardDelete(id: string) {} }; }\n',
  "src/lib/svc/client.ts": "export interface ApiClient { get(id: string): Promise<string>; delete(id: string): Promise<void> }\nexport function createApiClient(): ApiClient { return { get: async (id) => id, delete: async () => {} }; }\n",
  "src/features/s/service.ts": [
    'import { createService, createApiClient, type IdType } from "@/lib/svc";',
    "const base = createService();",
    "export const wrapped = { ...base, async remove(id: string) { await base.remove(id); } };",
    "export const plain = { ...base, remove: base.remove };",
    'const strategy: IdType = "uuid";',
    "export const shape = { IdType: strategy };",
    "export async function run() {",
    '  await base.remove("1");',
    '  await base["remove"]("1");',
    "  const { remove } = base;",
    "  const { remove: del } = base;",
    '  await wrapped.remove("1");',
    "  const client = createApiClient();",
    '  await client.getById("1");',
    "  const map = new Map<string, number>();",
    '  map.delete("x");',
    "  const other = { remove(id: string) { return id; } };",
    '  other.remove("1");',
    "  const loose: any = base;",
    '  loose.remove("1");',
    "  document.body.remove();",
    "  return [remove, del];",
    "}",
    "",
  ].join("\n"),
};
const SVC_TABLE = [
  { segment: "k5", lib: "svc", kind: "method", from: "remove", to: "delete", receivers: "service" },
  { segment: "k5", lib: "svc", kind: "method", from: "getById", to: "get", receivers: "ApiClient" },
  { segment: "k5", lib: "svc", kind: "export", from: "IdType", to: "IdStrategy" },
];

test("改名表: method の行は型で受け手が lib の物と分かる所だけ(包みの上書きとその呼び出し・[\"…\"]・分割代入)、export の行は import と参照。別の型の同じ名前・any は触らない", () => {
  const root = makeRepo(RENAMED_SVC);
  const plan = planCodemod(root, { table: SVC_TABLE });
  assert.deepEqual(
    plan.changes.map((c) => `${c.line} ${c.text}`).sort(),
    [
      '1 import { createService, createApiClient, type IdStrategy } from "@/lib/svc";',
      "10 delete: remove",
      "11 delete",
      "12 delete",
      "14 get",
      "3 delete",
      "3 delete",
      "4 delete",
      "4 delete",
      "5 IdStrategy",
      "8 delete",
      '9 "delete"',
    ],
    "6 行目の鍵 IdType・Map の delete・別の object の remove・DOM の remove は触らない",
  );
  assert.deepEqual(plan.stops.map((s) => `${s.line} ${s.kind}`), ["20 untyped"], "any の受け手は書き換えず報告");

  applyCodemod(root, plan);
  const after = readFileSync(path.join(root, "src/features/s/service.ts"), "utf8");
  assert.match(after, /export const wrapped = \{ \.\.\.base, async delete\(id: string\) \{ await base\.delete\(id\); \} \};/);
  assert.match(after, /const \{ delete: remove \} = base;/);
  assert.match(after, /export const shape = \{ IdType: strategy \};/);
  assert.match(after, /other\.remove\("1"\);/);
  assert.deepEqual(planCodemod(root, { table: SVC_TABLE }).changes, [], "2 回目は 0");
});

test("改名表: lib を改名する前の木(受け手が古い名前を持つ)では何も書き換えない。表の形の誤りは throw", () => {
  const before = {
    ...RENAMED_SVC,
    "src/lib/svc/service.ts": 'export type IdType = "uuid" | "db";\nexport function createService() { return { async get(id: string) { return id; }, async remove(id: string) {} }; }\n',
    "src/lib/svc/index.ts": 'export { createService, type IdType } from "./service";\nexport { createApiClient, type ApiClient } from "./client";\n',
    "src/lib/svc/client.ts": "export interface ApiClient { getById(id: string): Promise<string> }\nexport function createApiClient(): ApiClient { return { getById: async (id) => id }; }\n",
  };
  const plan = planCodemod(makeRepo(before), { table: SVC_TABLE });
  assert.deepEqual(plan.changes, []);
  assert.throws(() => validateRenames([{ segment: "k5", lib: "svc", kind: "rename", from: "a", to: "b" }]), /kind/);
  assert.throws(() => validateRenames([{ segment: "k5", lib: "svc", kind: "method", from: "a", to: "a" }]), /from \/ to/);
  assert.deepEqual(loadRenames().length >= 0, true, "同梱の renames.json は形が正しい");
});

/** git の見本: 閉じる前の lib "raw"(package.json なし)から、名前を閉じた lib "def" と "url2" へ移す。ファイルごと移した物(paths.ts)と、名前だけ移した物 */
function makeLooseRepo() {
  const root = makeRepo({
    "src/lib/def/package.json": { exports: { ".": "./index.ts" } },
    "src/lib/def/index.ts": "export const other = 1;\n",
    "src/lib/url2/package.json": { exports: { ".": "./index.ts" } },
    "src/lib/url2/index.ts": "export const sanitize = 1;\n",
    "src/lib/raw/index.ts": 'export { keep, ID } from "./types";\n',
    "src/lib/raw/types.ts": 'export const keep = 1;\nexport const ID = "id";\n',
    "src/lib/raw/utils/paths.ts": "export function adminPaths() { return 1; }\nexport function returnTo() { return 2; }\n",
    "src/features/f/F.ts": [
      'import { keep, ID } from "@/lib/raw";',
      'import { ID as Key } from "@/lib/raw/types";',
      'import { adminPaths, returnTo } from "@/lib/raw/utils/paths";',
      'import { notThere } from "@/lib/raw";',
      "",
    ].join("\n"),
  });
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.test", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.test" } });
  git("init", "-q");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  const base = git("rev-parse", "HEAD").trim();
  mkdirSync(path.join(root, "src/lib/def/routes"), { recursive: true });
  git("mv", "src/lib/raw/utils/paths.ts", "src/lib/def/routes/paths.ts");
  writeFileSync(path.join(root, "src/lib/def/routes/paths.ts"), "export function adminPaths() { return 1; }\n");
  writeFileSync(path.join(root, "src/lib/url2/returnTo.ts"), "export function returnTo() { return 2; }\n");
  writeFileSync(path.join(root, "src/lib/url2/index.ts"), 'export const sanitize = 1;\nexport { returnTo } from "./returnTo";\n');
  writeFileSync(path.join(root, "src/lib/raw/index.ts"), 'export { keep } from "./types";\n');
  writeFileSync(path.join(root, "src/lib/raw/types.ts"), "export const keep = 1;\n");
  writeFileSync(path.join(root, "src/lib/def/id.ts"), 'export const ID = "id";\n');
  writeFileSync(path.join(root, "src/lib/def/index.ts"), 'export const other = 1;\nexport { ID } from "./id";\nexport { adminPaths } from "./routes/paths";\n');
  git("add", "-A");
  git("commit", "-q", "-m", "head");
  clearLibPackageCache();
  return { root, base };
}

test("閉じる前の lib のファイルから出ていった名前も行き先へ(ファイルに残る名前はそのまま)。消えたファイルは --base で名前ごとに。決まらない文は止めずに見送る", () => {
  const { root, base } = makeLooseRepo();
  const plan = planCodemod(root, { base, table: [] });
  assert.deepEqual(
    plan.changes.map((c) => `${c.line} ${c.text}`),
    [
      '1 import { keep } from "@/lib/raw";\nimport { ID } from "@/lib/def";',
      '2 import { ID as Key } from "@/lib/def";',
      '3 import { adminPaths } from "@/lib/def";\nimport { returnTo } from "@/lib/url2";',
    ],
  );
  assert.deepEqual(plan.stops, [], "閉じた lib の外の文(4 行目の無い名前)は止めずに見送る");
  const noBase = planCodemod(root, { table: [] });
  assert.deepEqual(
    noBase.changes.map((c) => c.line),
    [1, 2],
    "--base なしでは消えたファイル(3 行目)は引けない",
  );
});
