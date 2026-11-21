// scripts/workflow/notices/lib.hotfixGaps.test.mjs — 修正を載せた木で前提が揃うかを見る部品(hotfixApply・pickCheck が使う)。実行: pnpm test scripts/workflow/notices
import { test } from "node:test";
import assert from "node:assert/strict";
import { exportedNames, findGaps, hasGaps, importGaps, namedImports, noticePaths, noticeSections, pnpmEntries, pnpmScripts, relativeImports } from "./lib.hotfixGaps.mjs";

const NOTICE = `# DOWNSTREAM NOTICE id:x
change: c
required_actions:
- run \`pnpm ownership:check\` and \`pnpm install\`, read \`src/lib/forkOwnership/README.md\`
verify: \`pnpm -s test:core-rules\` passes; \`pnpm run lint\`
manual_steps: -
refs: .claude/rules/core/extensions.md | docs/x.md | council 1
notes: \`pnpm not-a-step\` \`src/not/a/step.ts\`
`;

test("notice: the steps are required_actions up to refs:, refs: separately", () => {
  const { steps, refs } = noticeSections(NOTICE);
  assert.ok(steps.includes("ownership:check") && !steps.includes("not-a-step"));
  assert.equal(refs.trim(), ".claude/rules/core/extensions.md | docs/x.md | council 1");
});

test("notice: pnpm scripts (builtins left out, -s / run read through)", () => {
  assert.deepEqual(pnpmScripts(noticeSections(NOTICE).steps).sort(), ["lint", "ownership:check", "test:core-rules"]);
});

test("notice: repo paths named (backticks and refs:), globs and placeholders left out", () => {
  const { steps, refs } = noticeSections(NOTICE);
  assert.deepEqual(noticePaths(steps, refs).sort(), [".claude/rules/core/extensions.md", "docs/x.md", "src/lib/forkOwnership/README.md"]);
  assert.deepEqual(noticePaths("`src/**/a.ts` `src/<x>/a.ts`", ""), []);
});

test("gaps: a rule glob, a script and a path the tree does not have", () => {
  const rule = { file: ".claude/rules/core/e.md", text: '---\npaths:\n  - "src/lib/forkOwnership/**"\n  - "src/app/**"\n---\n# e\n' };
  const g = findGaps({ files: ["src/app/page.tsx", "docs/x.md", ".claude/rules/core/extensions.md"], packageJson: { scripts: { lint: "x", "test:core-rules": "x" } }, rules: [rule], notice: NOTICE });
  assert.deepEqual(g.rules, [{ file: ".claude/rules/core/e.md", globs: ["src/lib/forkOwnership/**"] }]);
  assert.deepEqual(g.scripts, ["ownership:check"]);
  assert.deepEqual(g.paths, ["src/lib/forkOwnership/README.md"]);
  assert.ok(hasGaps(g));
  const all = findGaps({ files: ["src/app/page.tsx", "src/lib/forkOwnership/README.md", "docs/x.md", ".claude/rules/core/extensions.md"], packageJson: { scripts: { lint: "", "test:core-rules": "", "ownership:check": "" } }, rules: [rule], notice: NOTICE });
  assert.equal(hasGaps(all), false);
});

test("gaps: entries named by file (pnpm workflow|ops <target> <action>, pnpm check|generate <target>, pnpm test <path>)", () => {
  const steps = "- run `pnpm workflow ownership check`, `pnpm ops db seed --all`, `pnpm check registry`, `pnpm generate domain -- Sample`, `pnpm test scripts/structure/config/a.test.mjs --db`";
  assert.deepEqual(pnpmEntries(steps).map((e) => e.label), ["workflow ownership check", "ops db seed", "check registry", "generate domain", "test scripts/structure/config/a.test.mjs"]);
  const notice = `# DOWNSTREAM NOTICE id:y\nrequired_actions:\n${steps}\nrefs: -\n`;
  const scripts = { workflow: "", ops: "", check: "", generate: "", test: "" };
  const have = ["scripts/workflow/ownership/check.mjs", "scripts/operations/db/seed.ts", "scripts/structure/registry/gate.json", "scripts/structure/domain/gate.json", "scripts/structure/config/a.test.mjs"];
  assert.deepEqual(findGaps({ files: have, packageJson: { scripts }, rules: [], notice }).scripts, []);
  assert.deepEqual(findGaps({ files: have.slice(1, 3), packageJson: { scripts }, rules: [], notice }).scripts, ["workflow ownership check", "generate domain", "test scripts/structure/config/a.test.mjs"]);
});

test("notice: pnpm workflow|ops|check|generate|test are entries, never counted as script names (no 'scripts workflow' / 'scripts test')", () => {
  assert.deepEqual(pnpmScripts("`pnpm workflow agent-terminal compactPlan`; `pnpm test scripts/x.test.mjs`; `pnpm check rules`; `pnpm lint`"), ["lint"]);
});

test("imports: relative import targets the tree lacks, a file whose every target is missing in one row (先取りしても動かない)", () => {
  const files = ["scripts/w/a/compactPlan.mjs", "scripts/w/a/has.mjs", "src/x.ts", "src/y/index.ts", "src/z.ts"];
  const texts = {
    "scripts/w/a/compactPlan.mjs": 'import { a } from "./lib.mjs";\nimport { b } from "./compactSelf.mjs";\nimport fs from "node:fs";\nexport const plan = 1;\n',
    "src/x.ts": 'import { y } from "./y";\nexport { z } from "./z.js";\nconst w = await import("./w");\nimport "./side.css";\n',
    "scripts/w/a/has.mjs": 'import { plan } from "./compactPlan.mjs";\n',
    "docs/readme.md": 'import { q } from "./q";\n',
  };
  assert.deepEqual(relativeImports(texts["src/x.ts"]).sort(), ["./side.css", "./w", "./y", "./z.js"]);
  const gaps = importGaps({ files, changed: ["scripts/w/a/compactPlan.mjs", "src/x.ts", "scripts/w/a/has.mjs", "docs/readme.md"], read: (f) => texts[f] ?? null });
  assert.deepEqual(gaps, [
    { file: "scripts/w/a/compactPlan.mjs", all: true, targets: ["./lib.mjs", "./compactSelf.mjs"] },
    { file: "src/x.ts", target: "./w" },
    { file: "src/x.ts", target: "./side.css" },
  ]);
});

test("imports: a name imported from a file the tree has but that does not export it makes the file unrunnable (Aurora: compactPlan.mjs `{ handoffFile }`, fork's lib.mjs without it)", () => {
  const files = ["a/compactPlan.mjs", "a/lib.mjs", "a/star.mjs", "a/ok.mjs", "a/t.ts", "a/d.mjs"];
  const texts = {
    "a/compactPlan.mjs": 'import { handoffFile, sessionOf as s } from "./lib.mjs";\nimport { anything } from "./star.mjs";\nimport type { T } from "./t";\nimport { type U, ok } from "./ok.mjs";\nimport d from "./d.mjs";\n',
    "a/lib.mjs": "export function sessionOf() {}\nexport const other = 1;\n",
    "a/star.mjs": 'export * from "./lib.mjs";\n',
    "a/ok.mjs": "const ok = 1;\nexport { ok };\n",
    "a/t.ts": "",
    "a/d.mjs": "export default 1;\n",
  };
  assert.deepEqual([...namedImports(texts["a/compactPlan.mjs"])], [["./lib.mjs", ["handoffFile", "sessionOf"]], ["./star.mjs", ["anything"]], ["./ok.mjs", ["ok"]]]);
  assert.deepEqual([...exportedNames("export async function a() {}\nexport class B {}\nexport { c, d as e };\nexport * as ns from './x';\nexport default 1;")].sort(), ["B", "a", "c", "default", "e", "ns"]);
  assert.equal(exportedNames(texts["a/star.mjs"]), null);
  assert.deepEqual(importGaps({ files, changed: ["a/compactPlan.mjs"], read: (f) => texts[f] ?? null }), [
    { file: "a/compactPlan.mjs", all: true, targets: ["./lib.mjs (handoffFile が無い)"] },
  ]);
  texts["a/lib.mjs"] += "export const handoffFile = () => {};\n";
  assert.deepEqual(importGaps({ files, changed: ["a/compactPlan.mjs"], read: (f) => texts[f] ?? null }), []);
});
