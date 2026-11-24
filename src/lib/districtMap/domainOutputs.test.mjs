// 生成器の出力の宣言の読み手 normalizeGateOutputs のテスト(1 つの形 { glob, kind, source, part? }、D318)。
// - strict(このリポの phase.json の検査): 1 つの形だけを通す(glob の文字列の略記・kind / source の省略・知らない欄は止める)、part は空でない文字列
// - strict でない(古い木の読み、D313): 短い形もそろえて読む(文字列 = every-run、kind の省略 = every-run)
// - このリポの全 phase.json は strict で通る
// 実行: pnpm test src/lib/districtMap/domainOutputs.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

import { intakeOutputGlobs, normalizeGateOutputs } from "./domainOutputs.mjs";

const ROOT = join(import.meta.dirname, "../../..");
const FULL = { glob: "src/a.ts", kind: "every-run", source: "scripts/structure/a/phase.json" };

test("strict: 1 つの形だけを通し、part を読む", () => {
  assert.deepEqual(normalizeGateOutputs([FULL, { ...FULL, glob: "vercel.json", part: "crons" }], { strict: true }), {
    entries: [FULL, { ...FULL, glob: "vercel.json", part: "crons" }],
    problems: [],
  });
});

test("strict: 略記・欄の省略・知らない欄・空の part は止める", () => {
  const problemsOf = (/** @type {unknown} */ outputs) => normalizeGateOutputs(outputs, { strict: true }).problems.join("\n");
  assert.match(problemsOf(["src/a.ts"]), /outputs\[0\] は \{ glob, kind, source, part\? \}.*outputs-form\.mjs/);
  assert.match(problemsOf([{ glob: "src/a.ts", source: "x" }]), /outputs\[0\] の kind が無い/);
  assert.match(problemsOf([{ glob: "src/a.ts", kind: "every-run" }]), /outputs\[0\] の source が無い/);
  assert.match(problemsOf([{ ...FULL, extra: 1 }]), /知らない欄 extra/);
  assert.match(problemsOf([{ ...FULL, part: "" }]), /part は空でない文字列/);
});

test("strict でない(古い木): 文字列・kind の省略もそろえる", () => {
  assert.deepEqual(normalizeGateOutputs(["src/a.ts", { glob: "src/b.ts" }]), {
    entries: [
      { glob: "src/a.ts", kind: "every-run" },
      { glob: "src/b.ts", kind: "every-run" },
    ],
    problems: [],
  });
});

test("受け口の一覧の generated の行: every-run で part の無い物だけ(part = ファイルの中の持ち分、ファイルの種類は別の行)", () => {
  const outputs = [
    { glob: "src/registry/a.ts", kind: "every-run", source: "s" },
    { glob: "vercel.json", kind: "every-run", source: "s", part: "crons" },
    { glob: "src/domains/**/plugs/messages/*.ts", kind: "write-once", source: "s" },
  ];
  assert.deepEqual(intakeOutputGlobs(outputs), ["src/registry/a.ts"]);
});

test("このリポの全 phase.json の outputs は strict で通る", () => {
  const base = join(ROOT, "scripts");
  for (const kind of readdirSync(base)) {
    if (!statSync(join(base, kind)).isDirectory()) continue;
    for (const name of readdirSync(join(base, kind))) {
      const file = join(base, kind, name, "phase.json");
      if (!existsSync(file)) continue;
      const decl = JSON.parse(readFileSync(file, "utf8"));
      assert.deepEqual(normalizeGateOutputs(decl.outputs, { strict: true }).problems, [], `scripts/${kind}/${name}/phase.json`);
    }
  }
});
