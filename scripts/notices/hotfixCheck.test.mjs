// scripts/notices/hotfixCheck.test.mjs — pnpm notices:hotfix-check の部品と、小さなリポでの通し。実行: pnpm test:notices
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkOnBase, findGaps, hasGaps, ledgerPicks, noticePaths, noticeSections, pnpmScripts, run } from "./hotfixCheck.mjs";

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

/** 小さなリポ(git の手続きと書き込み) */
function miniRepo(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  const g = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const put = (f, t) => {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), t);
  };
  const commit = (m) => {
    g("add", "-A");
    g("commit", "-qm", m);
    return g("rev-parse", "HEAD");
  };
  g("init", "-q", "-b", "main");
  g("config", "user.email", "t@t");
  g("config", "user.name", "t");
  return { dir, g, put, commit };
}

test("ledger: picked: shas in line order, once each, other lines left out", () => {
  const text = [
    "# applied",
    "- id:a | date:x | commit:1111111 | upstream:" + "0".repeat(40) + " | picked:" + "a".repeat(40) + " | notes:-",
    "- id:b | date:x | commit:2222222 | upstream:" + "0".repeat(40) + " | notes:picked:" + "c".repeat(40),
    "- id:c | date:x | commit:3333333 | upstream:" + "0".repeat(40) + " | picked:" + "b".repeat(40) + " | relay:none | notes:-",
    "- id:d | date:x | commit:4444444 | upstream:" + "0".repeat(40) + " | picked:" + "a".repeat(40) + " | notes:-",
  ].join("\n");
  assert.deepEqual(ledgerPicks(text), ["a".repeat(40), "b".repeat(40)]);
  assert.deepEqual(ledgerPicks(""), []);
});

test("relative refs (HEAD, HEAD~1) are resolved in the calling repo, not inside the temporary clone", () => {
  const r = miniRepo("hotfix-rel-");
  try {
    r.put("package.json", '{"scripts":{}}');
    r.commit("base");
    r.put("src/lib/newThing/index.ts", "x");
    r.commit("between");
    r.put(".notices/20990101-000000-x.md", "# DOWNSTREAM NOTICE id:20990101-000000-x\nrequired_actions:\n- read `src/lib/newThing/index.ts`\nverify: ok\nrefs: -\n");
    r.commit("hotfix");
    const out = [];
    assert.equal(run(r.dir, ["HEAD", "--base=HEAD~1"], (l) => out.push(l)), 0);
    assert.match(out.join("\n"), /依存なし/);
    const out2 = [];
    assert.equal(run(r.dir, ["HEAD", "--base=HEAD~2"], (l) => out2.push(l)), 1);
    assert.match(out2.join("\n"), /src\/lib\/newThing\/index\.ts がその木に無い/);
    assert.equal(hasGaps(checkOnBase(r.dir, "HEAD", "HEAD~2").gaps), true);
    assert.equal(run(r.dir, ["HEAD", "--base=nope"], () => {}), 2);
  } finally {
    rmSync(r.dir, { recursive: true, force: true });
  }
});

test("fleet.conf: a fork's picked: is laid on its merge-base first, forks with the same base + picks are checked once", () => {
  const up = miniRepo("hotfix-up-");
  const forks = [];
  const tmp = mkdtempSync(join(tmpdir(), "hotfix-conf-"));
  try {
    up.put("package.json", '{"scripts":{}}');
    up.put("doc.md", "line 1\n");
    const base = up.commit("base");
    up.put("doc.md", "line 1 picked\n");
    const picked = up.commit("earlier fix the forks picked");
    up.put("doc.md", "line 1 picked and hot\n");
    const hot = up.commit("hotfix on top of the earlier fix");
    const fork = (name, withPick) => {
      const dir = join(tmp, name);
      execFileSync("git", ["clone", "-q", up.dir, dir], { stdio: "ignore" });
      const g = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
      g("config", "user.email", "t@t");
      g("config", "user.name", "t");
      g("remote", "rename", "origin", "upstream");
      g("reset", "-q", "--hard", base);
      if (withPick) {
        g("cherry-pick", "-x", picked);
        mkdirSync(join(dir, ".notices/applied"), { recursive: true });
        writeFileSync(join(dir, `.notices/applied/${name}.md`), `- id:p | date:x | commit:${g("rev-parse", "--short", "HEAD")} | upstream:${base} | picked:${picked} | notes:-\n`);
        g("add", "-A");
        g("commit", "-qm", "ledger");
      }
      forks.push(dir);
      return `${name} ${dir}`;
    };
    const conf = join(tmp, "fleet.conf");
    writeFileSync(conf, ["# test", fork("fa", true), fork("fb", true), fork("fc", false)].join("\n") + "\n");
    const out = [];
    const code = run(up.dir, [hot, `--fleet-conf=${conf}`], (l) => out.push(l));
    const text = out.join("\n");
    assert.match(text, /fa, fb\([0-9a-f]{8} \+picked 1\): 依存なし/);
    assert.match(text, /fc\([0-9a-f]{8}\): cherry-pick が衝突する/);
    assert.equal(code, 1);
    const out2 = [];
    run(up.dir, [picked, `--fleet-conf=${conf}`], (l) => out2.push(l));
    assert.match(out2.join("\n"), /fa, fb\([0-9a-f]{8} \+picked 1\): この commit は先に取り済み/);
  } finally {
    rmSync(up.dir, { recursive: true, force: true });
    rmSync(tmp, { recursive: true, force: true });
  }
});
