// scripts/workflow/notices/lib.hotfixGaps.test.mjs — 修正を載せた木で前提が揃うかを見る部品(hotfixApply・pickCheck が使う)。実行: pnpm test scripts/workflow/notices
import { test } from "node:test";
import assert from "node:assert/strict";
import { findGaps, hasGaps, noticePaths, noticeSections, pnpmEntries, pnpmScripts } from "./lib.hotfixGaps.mjs";

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
