// scripts/workflow/rules/ruleSize.test.mjs
// 字数の線(lib.ruleSize.mjs)の振る舞いと、今の木の場面のデータの形。実行: pnpm test scripts/workflow/rules/ruleSize.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { judgeSize, longLines, parseScenes, sceneTotals, SIZE_LINES } from "./lib.ruleSize.mjs";

const repoRoot = join(import.meta.dirname, "../../..");
const rule = (paths, size) => `---\npaths:\n${paths.map((p) => `  - "${p}"\n`).join("")}---\n`.padEnd(size, "x");

test("線: 目標以下と知らせる線までは ok、知らせる線を超えると notify、失敗の線で fail", () => {
  const core = SIZE_LINES.core;
  assert.equal(judgeSize(core.target, core), "ok");
  assert.equal(judgeSize(core.notify, core), "ok");
  assert.equal(judgeSize(core.notify + 1, core), "notify");
  assert.equal(judgeSize(core.fail, core), "fail");
  const scene = SIZE_LINES.scene;
  assert.equal(judgeSize(scene.notify + 1, scene), "notify");
  assert.equal(judgeSize(scene.fail, scene), "fail");
});

test("CLAUDE.md は書き直しの出荷までは知らせるだけ(失敗の線を超えても止めない)", () => {
  const line = SIZE_LINES.claudeMd;
  assert.equal(line.fail, null);
  assert.equal(line.failLater, 36000);
  assert.equal(judgeSize(40000, line), "notify");
  assert.equal(judgeSize(line.notify, line), "ok");
});

test("1 行 400 字: 400 字は通り 401 字は挙がる", () => {
  const text = `${"a".repeat(400)}\n${"b".repeat(401)}\nok`;
  assert.deepEqual(longLines(text), [{ line: 2, length: 401 }]);
});

test("場面の合計: 場面のファイルに paths が当たる物だけを足す", () => {
  const scenes = [
    { id: "A", scene: "a", files: ["src/lib/x/a.ts"] },
    { id: "B", scene: "b", files: ["src/app/p/page.tsx", "src/lib/x/a.ts"] },
    { id: "C", scene: "c", files: ["docs/z.md"] },
  ];
  const rules = [
    { path: "lib.md", text: rule(["src/lib/**"], 100) },
    { path: "screens.md", text: rule(["src/app/**"], 300) },
  ];
  const totals = sceneTotals(scenes, rules);
  assert.deepEqual(totals.map((t) => [t.id, t.chars, t.loaded]), [
    ["A", 100, ["lib.md"]],
    ["B", 400, ["lib.md", "screens.md"]],
    ["C", 0, []],
  ]);
});

test("場面のデータ: 形が崩れた行は失敗", () => {
  assert.throws(() => parseScenes('{"id":"A","scene":"a","files":[]}\n'));
});

test("今の木: .claude/rules/core/scenes.jsonl は 22 場面(上流 10・fork 5・横断 7)、id は一意", () => {
  const scenes = parseScenes(readFileSync(join(repoRoot, ".claude/rules/core/scenes.jsonl"), "utf8"));
  const ids = scenes.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.filter((i) => i.startsWith("U")).length, 10);
  assert.equal(ids.filter((i) => i.startsWith("F")).length, 5);
  assert.equal(ids.filter((i) => i.startsWith("X")).length, 7);
});
