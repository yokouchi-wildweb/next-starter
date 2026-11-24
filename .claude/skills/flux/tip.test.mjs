// .claude/skills/flux/tip.test.mjs — 先端の版の道具を fork の中で走らせる(tip.mjs)を一時の上流と fork で通す。実行: pnpm test .claude/skills/flux/tip.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { importsOf, specifierKind, stripComments, walk } from "./tip.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TIP = join(HERE, "tip.mjs");
const REPO = join(HERE, "..", "..", "..");

/** 小さなリポ(clone すると上流は upstream) */
function repo(t, name, from) {
  const dir = mkdtempSync(join(tmpdir(), `tip-${name}-`));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const g = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (from) {
    rmSync(dir, { recursive: true, force: true });
    execFileSync("git", ["clone", "-q", from.dir, dir], { stdio: "ignore" });
    g("remote", "rename", "origin", "upstream");
  } else g("init", "-q", "-b", "main");
  g("config", "user.email", "t@t");
  g("config", "user.name", "t");
  return {
    dir,
    g,
    commit(files) {
      for (const [f, text] of Object.entries(files)) {
        mkdirSync(dirname(join(dir, f)), { recursive: true });
        writeFileSync(join(dir, f), text);
      }
      g("add", "-A");
      g("commit", "-qm", "c");
      return g("rev-parse", "HEAD");
    },
  };
}

const tip = (cwd, args) => spawnSync(process.execPath, [TIP, ...args], { cwd, encoding: "utf8" });

test("import の名指し: コメントの中は数えない、静的・export from・文字列 1 つの import()", () => {
  const text = [
    '// import x from "./commented.mjs"',
    '/* export * from "./block.mjs" */',
    'import a, { b } from "./a.mjs";',
    'import "./side.mjs";',
    'export { c } from "../c.mjs";',
    'import fs from "node:fs";',
    'const url = "http://example.com/x"; // not a comment start inside the string',
    'const re = /"\\/\\//;',
    'const lazy = () => import("./lazy.mjs");',
  ].join("\n");
  assert.deepEqual(importsOf(text), ["./a.mjs", "./side.mjs", "../c.mjs", "node:fs", "./lazy.mjs"]);
  assert.ok(stripComments(text).includes("http://example.com/x"));
  assert.equal(specifierKind("./a.mjs"), "relative");
  assert.equal(specifierKind("typescript"), "package");
  assert.equal(specifierKind("@scope/pkg"), "package");
  assert.equal(specifierKind("@/lib/x"), "project");
});

test("遅れた fork: 作業ツリーに無い先端のファイルを取り出して走らせる、引数と終了コードを渡す、取り出しは使い回す", (t) => {
  const up = repo(t, "up");
  up.commit({ "tool/main.mjs": 'import { say } from "./lib/say.mjs";\nsay();\n', "tool/lib/say.mjs": 'export const say = () => console.log("old");\n' });
  const fork = repo(t, "fork", up);
  const tipSha = up.commit({
    "tool/lib/say.mjs": 'import { version } from "./version.mjs";\nexport const say = () => { console.log(`${version} ${process.argv.slice(2).join(",")} ${process.cwd()}`); process.exitCode = Number(process.argv[2] ?? 0); };\n',
    "tool/lib/version.mjs": 'export const version = "tip";\n',
  });
  fork.g("fetch", "-q", "upstream");
  assert.ok(!existsSync(join(fork.dir, "tool/lib/version.mjs")));

  const first = tip(fork.dir, ["--upstream=upstream/main", "--entry=tool/main.mjs", "--", "3", "x"]);
  assert.equal(first.status, 3, first.stderr);
  assert.equal(first.stdout.trim(), `tip 3,x ${fork.g("rev-parse", "--show-toplevel")}`);
  assert.ok(existsSync(join(fork.dir, ".flux/tip", tipSha, "tool/lib/version.mjs")));

  const again = tip(fork.dir, ["--upstream=upstream/main", "--entry=tool/main.mjs", "--", "0"]);
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /^tip 0 /);
  assert.ok(!existsSync(join(fork.dir, ".flux/tip", `${tipSha}.partial-${again.pid}`)));
});

test("リポの中を名指す import(@/)・先端に無いファイル・解けない ref は exit 2", (t) => {
  const up = repo(t, "up");
  up.commit({ "a.mjs": 'import x from "@/lib/x";\n', "b.mjs": 'import "./missing.mjs";\n' });
  const atAlias = tip(up.dir, ["--upstream=main", "--entry=a.mjs"]);
  assert.equal(atAlias.status, 2);
  assert.match(atAlias.stderr, /a\.mjs.*@\/lib\/x/);
  const missing = tip(up.dir, ["--upstream=main", "--entry=b.mjs"]);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /missing\.mjs.*b\.mjs/);
  assert.equal(tip(up.dir, ["--upstream=nope/main", "--entry=a.mjs"]).status, 2);
  assert.equal(tip(up.dir, ["--entry=a.mjs"]).status, 2);
});

test("このリポの HEAD の who の読み手を取り出して答える(--json)", (t) => {
  const head = execFileSync("git", ["-C", REPO, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const dir = join(REPO, ".flux/tip", head);
  const existed = existsSync(dir);
  if (!existed) t.after(() => rmSync(dir, { recursive: true, force: true }));
  const result = tip(REPO, ["--upstream=HEAD", "--entry=scripts/workflow/ownership/who.mjs", "--", "--json", "--no-fetch", "src/registry/schemaRegistry.ts"]);
  assert.ok(result.status === 0 || result.status === 2, result.stderr);
  const answer = JSON.parse(result.stdout);
  assert.equal(typeof answer.status, "string");
  // exit 2 = who could not verify (no results in its answer): only the answer's form is read then
  if (result.status === 0) assert.equal(answer.results.length, 1);
  assert.ok(existsSync(join(dir, "src/lib/forkOwnership/whoCli.mjs")));
});

test("/flux が先端から走らせる読み手(who・selfKeep・段階の入口)の import の木は相対だけ(取り出せる)", () => {
  const head = execFileSync("git", ["-C", REPO, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  for (const entry of ["scripts/workflow/ownership/who.mjs", "scripts/workflow/ownership/selfKeep.mjs", "scripts/runner/phases/run.mjs"]) {
    assert.ok(walk(REPO, head, entry).size > 0, entry);
  }
});
