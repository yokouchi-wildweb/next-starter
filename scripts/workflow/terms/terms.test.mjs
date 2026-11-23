// scripts/workflow/terms/terms.test.mjs — 語の表と誤りの言い換えの検査(作り物のリポ)。実行: pnpm test scripts/workflow/terms/terms.test.mjs

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { areaOf, findHits, loadTerms, renderTermsMd, scan, TERMS_MD } from "./lib.terms.mjs";

const TABLE = readFileSync(join(import.meta.dirname, "terms.json"), "utf8");
const { terms, wrong } = loadTerms(TABLE);
const found = (path, text) => findHits(path, text, wrong).map((h) => h.found);

test("表: 語は en が一意、決定の番号を持つ。誤りの行は say と決定を持つ", () => {
  assert.equal(new Set(terms.map((t) => t.en)).size, terms.length);
  for (const t of terms) assert.ok(t.decisions.length > 0, t.en);
  for (const w of wrong) assert.ok(w.say && w.decisions.length > 0 && ["context", "tools", "both"].includes(w.in), w.say);
});

test("置き場: 文脈ファイル・道具・見ない所", () => {
  assert.equal(areaOf("CLAUDE.md"), "context");
  assert.equal(areaOf(".claude/rules/core/change.md"), "context");
  assert.equal(areaOf(".claude/skills/ship/SKILL.md"), "context");
  assert.equal(areaOf("scripts/runner/phases/run.mjs"), "tools");
  assert.equal(areaOf("eslint-rules/import-boundaries.mjs"), "tools");
  assert.equal(areaOf("eslint.config.mjs"), "tools");
  assert.equal(areaOf("eslint.config.core.mjs"), "tools");
  assert.equal(areaOf("package.json"), "tools");
  assert.equal(areaOf("scripts/workflow/terms/terms.json"), null);
  assert.equal(areaOf("scripts/workflow/rules/renames.json"), null);
  assert.equal(areaOf("src/domains/x/README.md"), null);
  assert.equal(areaOf(".notices/20261101-000000-x.md"), null);
});

test("当たる形: 置き場のパス・lint 名・段の旗とファイル・段の名前と組んだ門・旧語・型の名前としての overlay / placement", () => {
  assert.deepEqual(found("CLAUDE.md", "domain: src/features/ | @/features/x | src/config/features/a.config.ts"), ["src/features", "@/features", "config/features"]);
  assert.deepEqual(found("CLAUDE.md", "lint import-boundaries/lib-no-features"), ["lib-no-features"]);
  assert.deepEqual(found("scripts/x.mjs", 'run("pnpm check --gate=ship"); read("gate.json"); "scripts/runner/gates/run.mjs"'), ["--gate", "gate.json", "runner/gates"]);
  assert.deepEqual(found(".claude/rules/core/x.md", "門 build で回る"), ["門 build"]);
  assert.deepEqual(found(".claude/rules/core/x.md", "受け口 に足す・src_root_bases・基盤"), ["受け口", "src_root_bases", "基盤"]);
  assert.deepEqual(found("CLAUDE.md", "types: 1 replace | 2 overlay = x | 4 placement = src/styles/"), ["2 overlay", "4 placement"]);
  assert.deepEqual(found(".claude/rules/items/lib/a.md", "change: overlay = src/config/x | placement → src/config/y"), ["overlay =", "placement →"]);
  assert.deepEqual(found(".claude/rules/core/design.md", "the type (replace / overlay / add / placement)"), ["replace / overlay", "add / placement"]);
});

test("当たらない形: 門番の gate・画面の Overlays・置き場の意味の placement・機能の語・新しい語", () => {
  assert.deepEqual(found("CLAUDE.md", "read the gate only via gate / useGate | src/featureGate | pnpm ops features list"), []);
  assert.deepEqual(found(".claude/rules/core/components.md", "overlay: confirm → Overlays/Dialog | overlayClassName"), []);
  assert.deepEqual(found(".claude/rules/core/scripts.md", "placement: target = one folder | COMPONENTS placement"), []);
  assert.deepEqual(found(".claude/rules/items/components/Primitives.md", "raw parts such as Radix; placement → core/components.md primitives_place"), []);
  assert.deepEqual(found("CLAUDE.md", "src/domains/ | @/domains | --phase=ship | phase.json | 段階 build | 門番の規則"), []);
});

test("識別子: 道具のコードの名前だけ(文脈ファイルと名前の一部は当たらない)", () => {
  assert.deepEqual(found("scripts/a.mjs", "const featuresDir = 1; class GateError {}; loadGates();"), ["featuresDir", "GateError", "loadGates"]);
  assert.deepEqual(found("scripts/a.mjs", "const myfeaturesDirX = 1; gate.enabled('x');"), []);
  assert.deepEqual(found("scripts/README.md", "featuresDir を読む"), []);
  assert.deepEqual(found("CLAUDE.md", "featuresDir"), []);
});

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "terms-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

test("走査: 見る所の当たりを集め、見ない所と fork の自前のファイル(only の外)を見ない", () => {
  const root = fixture({
    "scripts/workflow/terms/terms.json": TABLE,
    "CLAUDE.md": "domain: src/features/\n",
    "scripts/x/run.mjs": "// --gate\n",
    "scripts/workflow/rules/renames.json": '{ "old": "src/features" }\n',
    "src/domains/a/README.md": "src/features\n",
    "scripts/mine/fork.mjs": "--gate\n",
  });
  assert.deepEqual(scan(root).map((h) => `${h.path}:${h.line} ${h.found}`), ["CLAUDE.md:1 src/features", "scripts/mine/fork.mjs:1 --gate", "scripts/x/run.mjs:1 --gate"]);
  const tier1Files = new Set(["CLAUDE.md", "scripts/x/run.mjs", "scripts/workflow/terms/terms.json"]);
  assert.deepEqual(scan(root, tier1Files).map((h) => h.path), ["CLAUDE.md", "scripts/x/run.mjs"]);
});

test("語の表の描き core/terms.md: paths・生成物の印・1 語 1 行。誤りの行の字面は書かず、走査の外", () => {
  const md = renderTermsMd({ terms: [{ en: "district", ja: "地区", meaning: "まとまり(旧: 受け口)" }, { en: "plug", ja: null, meaning: "差す側の項目" }], wrong: [{ say: "x", pattern: "受け口" }] });
  const lines = md.split("\n");
  assert.deepEqual(lines.slice(0, 7), ["---", "paths:", '  - "CLAUDE.md"', '  - "AGENTS.md"', '  - ".claude/rules/**"', '  - ".claude/skills/**"', "---"]);
  assert.equal(lines[7], "# terms");
  assert.ok(lines.some((l) => l.startsWith("> **GENERATED**:") && l.includes("scripts/workflow/terms/terms.json") && l.includes("pnpm generate terms")));
  assert.ok(lines.includes("- district: 地区 | まとまり(旧: 受け口)"));
  assert.ok(lines.includes("- plug: - | 差す側の項目"));
  assert.ok(!md.includes('"受け口"') && md.endsWith("\n"));
  assert.equal(areaOf(TERMS_MD), null);
});

test("上流の core/terms.md は正本 terms.json の描きそのもの(pnpm generate terms の出力)", () => {
  const root = join(import.meta.dirname, "../../..");
  assert.equal(readFileSync(join(root, TERMS_MD), "utf8"), renderTermsMd(JSON.parse(TABLE)));
});
