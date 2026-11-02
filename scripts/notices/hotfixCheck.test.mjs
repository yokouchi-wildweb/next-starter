// scripts/notices/hotfixCheck.test.mjs — pnpm notices:hotfix-check の部品と、小さなリポでの通し。実行: pnpm test:notices
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkOnBase, findGaps, hasGaps, noticePaths, noticeSections, pnpmScripts } from "./hotfixCheck.mjs";

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

test("through a repo: a hotfix whose rule names a folder only a later commit brings is reported on the old base", () => {
  const dir = mkdtempSync(join(tmpdir(), "hotfix-test-"));
  const g = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8" }).trim();
  const put = (f, t) => {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), t);
  };
  try {
    g("init", "-q", "-b", "main");
    g("config", "user.email", "t@t");
    g("config", "user.name", "t");
    put("package.json", '{"scripts":{}}');
    put("src/app/page.tsx", "x");
    g("add", "-A");
    g("commit", "-qm", "base");
    const base = g("rev-parse", "HEAD");
    put("src/lib/newThing/index.ts", "x");
    put("package.json", '{"scripts":{"new:check":"x"}}');
    g("add", "-A");
    g("commit", "-qm", "between");
    put(".claude/rules/core/new.md", '---\npaths:\n  - "src/lib/newThing/**"\n---\n# n\n');
    put(".notices/20990101-000000-x.md", "# DOWNSTREAM NOTICE id:20990101-000000-x\nrequired_actions:\n- `pnpm new:check`\nverify: ok\nrefs: src/lib/newThing/index.ts\n");
    g("add", "-A");
    g("commit", "-qm", "hotfix");
    const hot = g("rev-parse", "HEAD");
    const r = checkOnBase(dir, hot, base);
    assert.equal(r.conflict, false);
    assert.deepEqual(r.gaps.rules, [{ file: ".claude/rules/core/new.md", globs: ["src/lib/newThing/**"] }]);
    assert.deepEqual(r.gaps.scripts, ["new:check"]);
    assert.deepEqual(r.gaps.paths, ["src/lib/newThing/index.ts"]);
    assert.equal(hasGaps(checkOnBase(dir, hot, `${hot}~1`).gaps), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
