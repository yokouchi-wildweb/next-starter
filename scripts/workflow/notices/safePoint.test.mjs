// scripts/workflow/notices/safePoint.test.mjs — pnpm workflow notices safePoint(セーフポイントの tag・位置・本番の止め)を小さなリポで通す。
// 実行: pnpm test scripts/workflow/notices
// 親は bare の origin / upstream。全部の検査は --check の口で node の一行に差し替える
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { classify, deployVerdict, describe, nextTagName, parentForkId, parseSafeTags, PASS_FILE, proposeScore, readSafeTags, run } from "./safePoint.mjs";

const dirs = [];
after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const PASS = `node -e "process.exit(0)"`;
const FAIL = `node -e "process.exit(1)"`;
const MARK = `node -e "require('fs').writeFileSync('ran.txt','1')"`;
const DATE = "20261110";
const TIER1_RULES = "# project\nfork_id: next-starter\ndownstream: yes\n";

const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "safe-point-"));
  dirs.push(d);
  return d;
};
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

function init(dir) {
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.name", "t");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "commit.gpgSign", "false");
  git(dir, "config", "tag.gpgSign", "false");
}

function bare() {
  const d = tmp();
  git(d, "init", "-q", "--bare", "-b", "main");
  return d;
}

/** files を書いて commit し、完全な sha を返す */
function commit(dir, message, files = {}) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  writeFileSync(join(dir, "log.txt"), `${message}\n`);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", message);
  return git(dir, "rev-parse", "HEAD");
}

/** Tier1 の形のリポ(origin = bare)。commits = その数の commit を積んで push、[shas] */
function tier1(count = 1) {
  const dir = tmp();
  init(dir);
  const origin = bare();
  git(dir, "remote", "add", "origin", origin);
  const shas = [];
  for (let i = 0; i < count; i++) {
    shas.push(commit(dir, `c${i}`, i === 0 ? { ".claude/rules/project.md": TIER1_RULES, "src/lib/CATALOG.md": "# CATALOG\n\n## next-starter\n" } : {}));
  }
  git(dir, "push", "-q", "origin", "main");
  return { dir, origin, shas };
}

const logs = () => {
  const lines = [];
  return { lines, log: (s) => lines.push(s) };
};
const passFile = (dir) => resolve(dir, git(dir, "rev-parse", "--git-path", PASS_FILE));

test("parseSafeTags: 注釈つきは剥がした commit・軽い tag はそのまま、他の fork_id と形違いは捨て、-9 の後に -10", () => {
  const text = [
    "safe/next-starter/20261110-10 cccc aaaa",
    "safe/next-starter/20261110-9  bbbb",
    "safe/next-starter/20261109-3 dddd eeee",
    "safe/fork-a/20261110-1 ffff gggg",
    "safe/next-starter/foo  1111",
    "safe/next-starter/2026111-1  2222",
    "safe/20261110-1  3333",
  ].join("\n");
  assert.deepEqual(parseSafeTags(text, "next-starter"), [
    { tag: "safe/next-starter/20261109-3", commit: "dddd" },
    { tag: "safe/next-starter/20261110-9", commit: "bbbb" },
    { tag: "safe/next-starter/20261110-10", commit: "cccc" },
  ]);
  assert.deepEqual(parseSafeTags(text, "fork-a"), [{ tag: "safe/fork-a/20261110-1", commit: "ffff" }]);
});

test("nextTagName: 無ければ -1、最大 + 1(抜けは使わない)、他の日・他の fork_id は見ない", () => {
  const day = new Date(2026, 10, 10);
  assert.equal(nextTagName("next-starter", [], day), "safe/next-starter/20261110-1");
  assert.equal(nextTagName("next-starter", ["safe/next-starter/20261110-1", "safe/next-starter/20261110-2"], day), "safe/next-starter/20261110-3");
  assert.equal(nextTagName("next-starter", ["safe/next-starter/20261110-1", "safe/next-starter/20261110-3"], day), "safe/next-starter/20261110-4");
  assert.equal(nextTagName("next-starter", ["safe/next-starter/20261109-7", "safe/other/20261110-5"], day), "safe/next-starter/20261110-1");
});

/** a-b-c-d の直線、b と d に tag(origin に push) */
function linear() {
  const r = tier1(4);
  const [a, b, c, d] = r.shas;
  git(r.dir, "tag", "-a", "safe/next-starter/20261101-1", "-m", "s", b);
  git(r.dir, "tag", "safe/next-starter/20261102-1", d);
  git(r.dir, "push", "-q", "origin", "--tags");
  return { ...r, a, b, c, d };
}

test("classify / describe: at・past(N)・before・none", () => {
  const r = linear();
  const tags = readSafeTags(r.dir, "origin", "next-starter");
  assert.equal(describe(classify(r.dir, r.b, tags)), "at safe/next-starter/20261101-1");
  assert.equal(describe(classify(r.dir, r.c, tags)), "past safe/next-starter/20261101-1 (1 commits unverified)");
  assert.equal(describe(classify(r.dir, r.a, tags)), "before safe/next-starter/20261101-1");
  assert.equal(describe(classify(r.dir, r.d, tags)), "at safe/next-starter/20261102-1");
  assert.equal(describe(classify(r.dir, r.c, [])), "no safe point yet");
});

test("where: 4 つの形を 1 行で出す、知らない remote は exit 2", () => {
  const r = linear();
  const where = (at, remote = "origin", id = "next-starter") => {
    const l = logs();
    const code = run(r.dir, ["where", `--remote=${remote}`, `--at=${at}`, `--id=${id}`], l);
    return { code, lines: l.lines };
  };
  assert.deepEqual(where(r.b), { code: 0, lines: ["at safe/next-starter/20261101-1"] });
  assert.deepEqual(where(r.c), { code: 0, lines: ["past safe/next-starter/20261101-1 (1 commits unverified)"] });
  assert.deepEqual(where(r.a), { code: 0, lines: ["before safe/next-starter/20261101-1"] });
  assert.deepEqual(where(r.c, "origin", "fork-a"), { code: 0, lines: ["no safe point yet"] });
  const unknown = where(r.c, "nowhere");
  assert.equal(unknown.code, 2);
  assert.match(unknown.lines[0], /^safe-point: /);
});

/** 親(upstream = bare、fork_id: next-starter、p1-p2-p3、p2 に tag)と fork(fork_id: fork-a、remote upstream) */
function forkFixture() {
  const parent = tier1(3);
  const [p1, p2, p3] = parent.shas;
  git(parent.dir, "tag", "-a", "safe/next-starter/20261101-1", "-m", "s", p2);
  git(parent.dir, "push", "-q", "origin", "--tags");
  const dir = tmp();
  init(dir);
  git(dir, "remote", "add", "upstream", parent.origin);
  git(dir, "fetch", "-q", "upstream");
  git(dir, "reset", "-q", "--hard", "upstream/main");
  commit(dir, "fork", { ".claude/rules/project.md": "# project\nfork_id: fork-a\ndownstream: none\n" });
  const ledger = (sha) => {
    mkdirSync(join(dir, ".notices/applied"), { recursive: true });
    writeFileSync(join(dir, ".notices/applied/fork-a.md"), sha ? `# ledger\n- id:x | date:- | commit:- | upstream:${sha} | notes:-\n` : "# ledger\n");
  };
  return { dir, p1, p2, p3, ledger };
}

test("parentForkId: 親のブランチの project.md の fork_id:、無ければ throw", () => {
  const f = forkFixture();
  assert.equal(parentForkId(f.dir, "upstream"), "next-starter");
  const other = tmp();
  init(other);
  const otherOrigin = bare();
  git(other, "remote", "add", "origin", otherOrigin);
  commit(other, "x", { ".claude/rules/project.md": "# project\n" });
  git(other, "push", "-q", "origin", "main");
  git(f.dir, "remote", "add", "broken", otherOrigin);
  git(f.dir, "fetch", "-q", "broken");
  assert.throws(() => parentForkId(f.dir, "broken"), /親の fork_id が読めない/);
});

test("deployVerdict Tier1: HEAD が自分の safe tag ちょうどなら ok、他の fork_id の tag・一つ先は止める", () => {
  const r = tier1(1);
  git(r.dir, "tag", "safe/other/20261101-1", r.shas[0]);
  const other = deployVerdict(r.dir);
  assert.equal(other.ok, false);
  git(r.dir, "tag", "-a", "safe/next-starter/20261101-1", "-m", "s", r.shas[0]);
  git(r.dir, "push", "-q", "origin", "--tags");
  const ok = deployVerdict(r.dir);
  assert.equal(ok.ok, true, ok.message);
  assert.equal(ok.line, "at safe/next-starter/20261101-1");
  commit(r.dir, "more");
  const ahead = deployVerdict(r.dir);
  assert.equal(ahead.ok, false);
  assert.match(ahead.message, /\/ship/);
  assert.ok(ahead.message.endsWith("(どうしても出すなら --allow-unsafe=<理由>)"), ahead.message);
});

test("deployVerdict fork: 台帳の upstream が親の safe tag ちょうどで ok、自分の tag は数えない、手前は次の tag と /flux to を案内", () => {
  const f = forkFixture();
  f.ledger(f.p2);
  const ok = deployVerdict(f.dir);
  assert.equal(ok.ok, true, ok.message);
  assert.match(ok.message, /safe\/next-starter\/20261101-1/);

  f.ledger(f.p3);
  git(f.dir, "tag", "safe/fork-a/20261101-1", f.p3);
  const own = deployVerdict(f.dir);
  assert.equal(own.ok, false);
  assert.match(own.message, /から 1 commits 先/);

  f.ledger(f.p1);
  const behind = deployVerdict(f.dir);
  assert.equal(behind.ok, false);
  assert.match(behind.message, /次のセーフポイント safe\/next-starter\/20261101-1/);
  assert.match(behind.message, new RegExp(`/flux to ${f.p2.slice(0, 8)}`));

  f.ledger(null);
  assert.match(deployVerdict(f.dir).message, /upstream:<sha> が無い/);

  f.ledger(f.p2);
  const thrown = deployVerdict(f.dir, {
    readTags: () => {
      throw new Error("upstream の tag を取れない: boom");
    },
  });
  assert.equal(thrown.ok, false);
  assert.match(thrown.message, /upstream の tag を取れない: boom/);
});

test("check: 全部通れば HEAD を記録、一つ落ちれば exit 1 で記録なし、汚れた木は何も回さず exit 2", () => {
  const r = tier1(1);
  const head = r.shas[0];
  assert.equal(run(r.dir, ["check", `--check=${PASS}`, `--check=${PASS}`], logs()), 0);
  assert.equal(readFileSync(passFile(r.dir), "utf8").trim(), head);

  assert.equal(run(r.dir, ["check", `--check=${PASS}`, `--check=${FAIL}`], logs()), 1);
  assert.equal(existsSync(passFile(r.dir)), false);

  writeFileSync(join(r.dir, "log.txt"), "dirty\n");
  assert.equal(run(r.dir, ["check", `--check=${MARK}`], logs()), 2);
  assert.equal(existsSync(join(r.dir, "ran.txt")), false);
  assert.equal(existsSync(passFile(r.dir)), false);
});

test("tag: 記録が無い・HEAD と違う・push していないは exit 1、通れば注釈つきの tag を push、次は -2、同じ HEAD は既にある", () => {
  const r = tier1(1);
  const tag = () => {
    const l = logs();
    return { code: run(r.dir, ["tag", `--date=${DATE}`], l), lines: l.lines };
  };
  const remoteTags = () => git(r.dir, "ls-remote", "--tags", "origin", "refs/tags/safe/*");
  git(r.dir, "tag", `safe/other/${DATE}-5`);
  git(r.dir, "push", "-q", "origin", "--tags");

  assert.equal(tag().code, 1);
  assert.doesNotMatch(remoteTags(), /next-starter/);

  writeFileSync(passFile(r.dir), "0000000000000000000000000000000000000000\n");
  assert.equal(tag().code, 1);

  commit(r.dir, "unpushed");
  assert.equal(run(r.dir, ["check", `--check=${PASS}`], logs()), 0);
  assert.match(tag().lines[0], /push されていない/);
  git(r.dir, "push", "-q", "origin", "main");

  const first = tag();
  assert.equal(first.code, 0, first.lines.join("\n"));
  assert.match(remoteTags(), new RegExp(`refs/tags/safe/next-starter/${DATE}-1`));
  assert.equal(git(r.dir, "cat-file", "-t", `safe/next-starter/${DATE}-1`), "tag");
  assert.equal(existsSync(passFile(r.dir)), false);

  commit(r.dir, "second");
  git(r.dir, "push", "-q", "origin", "main");
  assert.equal(run(r.dir, ["check", `--check=${PASS}`], logs()), 0);
  assert.equal(tag().code, 0);
  assert.match(remoteTags(), new RegExp(`refs/tags/safe/next-starter/${DATE}-2`));

  assert.equal(run(r.dir, ["check", `--check=${PASS}`], logs()), 0);
  const again = tag();
  assert.equal(again.code, 0);
  assert.match(again.lines[0], /既にある/);
  assert.doesNotMatch(remoteTags(), new RegExp(`${DATE}-3`));
});

test("proposeScore: commits ÷ 80 + 日数 ÷ 3、小数 2 桁", () => {
  assert.equal(proposeScore(80, 0), 1);
  assert.equal(proposeScore(40, 1.5), 1);
  assert.equal(proposeScore(70, 1), 1.21);
  assert.equal(proposeScore(10, 0, 20, 3), 0.5);
});

test("status: tag 無しは propose、past は commits・日数・値、1 以上で propose、HEAD ちょうどは at、変な数は exit 2", () => {
  const r = tier1(3);
  const status = (...args) => {
    const l = logs();
    return { code: run(r.dir, ["status", ...args], l), lines: l.lines };
  };
  assert.deepEqual(status(), { code: 0, lines: ["no safe point yet (3 commits)", "propose"] });

  const tag = "safe/next-starter/20261101-1";
  git(r.dir, "tag", "-a", tag, "-m", "s", r.shas[0]);
  git(r.dir, "push", "-q", "origin", "--tags");
  const created = Number(git(r.dir, "for-each-ref", `refs/tags/${tag}`, "--format=%(creatordate:unix)"));
  const now = `--now=${created + 86400 * 1.5}`;
  assert.deepEqual(status(now), { code: 0, lines: [`past ${tag} (2 commits, 1.5 days, score 0.53)`] });
  assert.deepEqual(status(now, "--commits=2"), { code: 0, lines: [`past ${tag} (2 commits, 1.5 days, score 1.5)`, "propose"] });

  git(r.dir, "tag", "-d", tag);
  git(r.dir, "push", "-q", "origin", `:refs/tags/${tag}`);
  git(r.dir, "tag", "-a", tag, "-m", "s", r.shas[2]);
  git(r.dir, "push", "-q", "origin", "--tags");
  const at = status(`--now=${Number(git(r.dir, "for-each-ref", `refs/tags/${tag}`, "--format=%(creatordate:unix)"))}`);
  assert.deepEqual(at, { code: 0, lines: [`at ${tag} (0 days)`] });

  const bad = status("--days=0");
  assert.equal(bad.code, 2);
  assert.match(bad.lines[0], /^safe-point: /);
});

test("quickFiles: Ship: quick が続く間のファイル、印の無い commit・自分の safe tag で止まる、無ければ 0、最初まで続けば exit 2", () => {
  const r = tier1(2);
  const quick = () => {
    const l = logs();
    return { code: run(r.dir, ["quickFiles"], l), lines: l.lines };
  };
  assert.deepEqual(quick(), { code: 0, lines: ["0 quick commits unchecked"] });

  commit(r.dir, "q1\n\nShip: quick\nCo-Authored-By: t <t@example.com>", { "a.txt": "a" });
  commit(r.dir, "q2\n\nShip: quick", { "b.txt": "b" });
  assert.deepEqual(quick(), { code: 0, lines: ["2 quick commits unchecked", "a.txt", "b.txt", "log.txt"] });

  git(r.dir, "tag", "-a", "safe/next-starter/20261101-1", "-m", "s", "HEAD~1");
  assert.deepEqual(quick(), { code: 0, lines: ["1 quick commits unchecked", "b.txt", "log.txt"] });

  commit(r.dir, "plain", { "c.txt": "c" });
  assert.deepEqual(quick(), { code: 0, lines: ["0 quick commits unchecked"] });

  const fresh = tmp();
  init(fresh);
  commit(fresh, "q0\n\nShip: quick");
  const l = logs();
  assert.equal(run(fresh, ["quickFiles"], l), 2);
  assert.match(l.lines[0], /^safe-point: /);
});
