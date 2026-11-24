// 区切り flux-rebuild の道具 outputs-form(phase.json の outputs を 1 つの形へ)のテスト。
// - 文字列 → { glob, kind: every-run, source: その phase.json }、kind / source の無い行を埋める(write-once は書いた物そのもの)、part とほかの欄は残す
// - outputs の外の字面は変えない(1 行の JSON は 1 行、複数行は 1 行 1 項目で字下げを保つ)、2 回目は already
// - 宣言の無い phase は none、配列でない・glob の無い行は stop
// 実行: pnpm test .notices/20261124-033209-flux-rebuild.outputs-form.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import { planPhase, WRITE_ONCE_SOURCE } from "./20261124-033209-flux-rebuild.outputs-form.mjs";

const PATH = "scripts/structure/x/phase.json";

test("1 行の JSON: 文字列を 1 つの形にし、ほかの欄はそのまま。2 回目は already", () => {
  const text = '{ "generate": "generate.mjs", "outputs": ["src/a.ts", "src/b.ts"], "regions": ["src/r/**"] }\n';
  const plan = planPhase(PATH, text);
  assert.equal(plan.state, "apply");
  assert.equal(plan.lines, 2);
  assert.equal(
    plan.next,
    `{ "generate": "generate.mjs", "outputs": [{"glob": "src/a.ts", "kind": "every-run", "source": "${PATH}"}, {"glob": "src/b.ts", "kind": "every-run", "source": "${PATH}"}], "regions": ["src/r/**"] }\n`,
  );
  assert.equal(planPhase(PATH, plan.next).state, "already");
});

test("複数行: 欄の無い行を埋め(write-once は書いた物そのもの)、part は残し、字下げを保つ", () => {
  const text = [
    "{",
    '  "outputs": [',
    '    {"glob": "{dir}/a.ts", "kind": "every-run"},',
    '    {"glob": "{dir}/page.tsx", "kind": "write-once"},',
    '    {"glob": "vercel.json", "kind": "every-run", "source": "src/app/api/cron/*/task.ts", "part": "crons"}',
    "  ]",
    "}",
    "",
  ].join("\n");
  const plan = planPhase(PATH, text);
  assert.equal(plan.lines, 2);
  const decl = JSON.parse(plan.next);
  assert.deepEqual(decl.outputs, [
    { glob: "{dir}/a.ts", kind: "every-run", source: PATH },
    { glob: "{dir}/page.tsx", kind: "write-once", source: WRITE_ONCE_SOURCE },
    { glob: "vercel.json", kind: "every-run", source: "src/app/api/cron/*/task.ts", part: "crons" },
  ]);
  assert.match(plan.next, /\n {4}\{"glob": "\{dir\}\/a\.ts"/);
  assert.match(plan.next, /\n {2}\]\n\}\n$/);
});

test("宣言の無い phase は none、配列でない・glob の無い行は stop", () => {
  assert.equal(planPhase(PATH, '{ "check": "check.mjs" }').state, "none");
  assert.equal(planPhase(PATH, '{ "outputs": "src/a.ts" }').state, "stop");
  assert.equal(planPhase(PATH, '{ "outputs": [{ "kind": "every-run" }] }').state, "stop");
});
