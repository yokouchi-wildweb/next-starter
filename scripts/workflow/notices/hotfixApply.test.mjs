// hotfixApply.mjs の試し: 一時の上流と fork(os.tmpdir、ネットワーク不要)
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";

import { hotfixApply, ledgerNotes, ledgerPickedIds, mergeText, TIP_READ } from "./hotfixApply.mjs";

const ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t", GIT_CONFIG_GLOBAL: "/dev/null" };
const root = mkdtempSync(join(tmpdir(), "hotfix-apply-"));
after(() => rmSync(root, { recursive: true, force: true }));
const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", env: ENV });
const write = (repo, path, text) => {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
};
const read = (repo, path) => readFileSync(join(repo, path), "utf8");
const commit = (repo, msg) => {
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", msg);
  return git(repo, "rev-parse", "HEAD").trim();
};

let n = 0;
/** 上流(土台 → 間の変更 → 緊急修正)と、土台で分かれた fork */
function setup({ forkEdits = false } = {}) {
  const up = join(root, `up${++n}`);
  const fork = join(root, `fork${n}`);
  mkdirSync(up);
  git(up, "init", "-q", "-b", "main");
  write(up, "src/core.ts", "a\nb\nc\n");
  write(up, "src/own.ts", "x\n");
  write(up, ".claude/skills/flux/SKILL.md", "flux 1\n");
  commit(up, "base");
  git(root, "clone", "-q", "-o", "upstream", up, fork);
  // 上流の間の変更(fork はまだ取り込んでいない)
  write(up, "src/core.ts", "A\nb\nc\n");
  write(up, "src/own.ts", "X\n");
  write(up, ".claude/skills/flux/SKILL.md", "flux 2\n");
  commit(up, "between");
  // 緊急修正: 同じファイルの同じ所を直す(土台の上ではぶつかる)
  write(up, "src/core.ts", "A2\nb\nc\n");
  if (forkEdits) write(up, "src/own.ts", "X2\n");
  write(up, ".claude/skills/flux/SKILL.md", "flux 3\n");
  write(up, ".notices/20261120-000000-hot.md", "# DOWNSTREAM NOTICE id:20261120-000000-hot\nhotfix: test\n");
  const hot = commit(up, "fix: 直す");
  if (forkEdits) {
    write(fork, "src/own.ts", "mine\n");
    commit(fork, "fork: own edit");
  }
  git(fork, "fetch", "-q", "upstream");
  return { up, fork, hot };
}

test("(c) fork が触っていない(上流の版と同じ)ファイルは元の commit の版に置き換え、先端を読むファイルは外し、足すファイルは足す", () => {
  const { fork, hot } = setup();
  const before = git(fork, "rev-parse", "HEAD").trim();
  const r = hotfixApply(fork, hot, "upstream/main");
  assert.equal(r.status, "picked");
  assert.deepEqual(r.replaced, ["src/core.ts"]);
  assert.deepEqual(r.leftOut, [".claude/skills/flux/SKILL.md"]);
  assert.equal(read(fork, "src/core.ts"), "A2\nb\nc\n");
  assert.equal(read(fork, ".claude/skills/flux/SKILL.md"), "flux 1\n");
  assert.equal(read(fork, ".notices/20261120-000000-hot.md").split("\n")[0], "# DOWNSTREAM NOTICE id:20261120-000000-hot");
  assert.equal(git(fork, "rev-parse", "HEAD~1").trim(), before);
  assert.match(git(fork, "log", "-1", "--format=%B"), new RegExp(`\\(cherry picked from commit ${hot}\\)`));
  assert.equal(git(fork, "status", "--porcelain").trim(), "");
  assert.deepEqual(r.added, [".notices/20261120-000000-hot.md"]);
  assert.equal(ledgerNotes(r), "hotfix pick; replaced: src/core.ts; added: .notices/20261120-000000-hot.md; left-out: .claude/skills/flux/SKILL.md");
});

test("fork が手で変えたファイルの 3 方向がぶつかったら何も変えずに止まる(枝も作業ツリーも元のまま)", () => {
  const { fork, hot } = setup({ forkEdits: true });
  const before = git(fork, "rev-parse", "HEAD").trim();
  const r = hotfixApply(fork, hot, "upstream/main");
  assert.equal(r.status, "conflict");
  assert.deepEqual(r.conflicts, ["src/own.ts"]);
  assert.equal(git(fork, "rev-parse", "HEAD").trim(), before);
  assert.equal(git(fork, "status", "--porcelain").trim(), "");
  assert.equal(read(fork, "src/own.ts"), "mine\n");
});

test("作業ツリーが汚れていれば何もしない", () => {
  const { fork, hot } = setup();
  write(fork, "src/core.ts", "dirty\n");
  const r = hotfixApply(fork, hot, "upstream/main");
  assert.equal(r.status, "error");
  assert.match(r.message, /未コミット/);
});

test("先端を読む置き場は .claude/skills/flux/", () => {
  assert.deepEqual(TIP_READ, [".claude/skills/flux/"]);
});

/** 小さな上流と fork: files で土台、between で間の変更、hot で緊急修正、forkFiles で fork の変更 */
function small({ files, between = {}, hot, forkFiles = {}, gone = [], moves = [] }) {
  const up = join(root, `up${++n}`);
  const fork = join(root, `fork${n}`);
  mkdirSync(up);
  git(up, "init", "-q", "-b", "main");
  for (const [p, t] of Object.entries(files)) write(up, p, t);
  commit(up, "base");
  git(root, "clone", "-q", "-o", "upstream", up, fork);
  for (const [from, to] of moves) git(up, "mv", from, to);
  for (const [p, t] of Object.entries(between)) write(up, p, t);
  if (moves.length || Object.keys(between).length) commit(up, "between");
  for (const [p, t] of Object.entries(hot)) t === null ? git(up, "rm", "-q", p) : write(up, p, t);
  const sha = commit(up, "fix");
  for (const [p, t] of Object.entries(forkFiles)) write(fork, p, t);
  for (const p of gone) git(fork, "rm", "-q", p);
  if (Object.keys(forkFiles).length || gone.length) commit(fork, "fork edits");
  git(fork, "fetch", "-q", "upstream");
  return { up, fork, hot: sha };
}

test("fork が手で変えたファイルは 3 方向で合わせる(別の行なら通る)", () => {
  const { fork, hot } = small({ files: { "src/a.ts": "1\n2\n3\n4\n5\n" }, hot: { "src/a.ts": "1\n2\n3\n4\nFIX\n" }, forkFiles: { "src/a.ts": "MINE\n2\n3\n4\n5\n" } });
  const r = hotfixApply(fork, hot, "upstream/main");
  assert.equal(r.status, "picked");
  assert.deepEqual(r.merged, ["src/a.ts"]);
  assert.equal(read(fork, "src/a.ts"), "MINE\n2\n3\n4\nFIX\n");
});

test("上流で後から移されたファイルの直しは left-out、名前の変わった候補を出すだけ(前の場所は変えない、D476)", () => {
  const { fork, hot } = small({ files: { "src/old.ts": "1\n2\n3\n4\n5\n" }, moves: [["src/old.ts", "src/new.ts"]], hot: { "src/new.ts": "1\n2\n3\n4\nFIX\n" } });
  const r = hotfixApply(fork, hot, "upstream/main");
  assert.equal(r.status, "picked");
  assert.deepEqual(r.leftOut, ["src/new.ts"]);
  assert.equal(r.renameCandidates.length, 1);
  assert.deepEqual([r.renameCandidates[0].path, r.renameCandidates[0].from, r.renameCandidates[0].to], ["src/new.ts", "src/old.ts", "src/new.ts"]);
  assert.match(r.renameCandidates[0].score, /^R\d+$/);
  assert.equal(read(fork, "src/old.ts"), "1\n2\n3\n4\n5\n");
  assert.match(ledgerNotes(r), /left-out: src\/new\.ts; rename-candidate: src\/old\.ts->src\/new\.ts\(R\d+\)$/);
  assert.ok(!("movedMerged" in r));
});

test("(b) 直す相手が fork の木に無ければ飛ばして left-out(止めない)", () => {
  const { fork, hot } = small({ files: { "src/a.ts": "a\n" }, between: { "src/later.ts": "l\n" }, hot: { "src/later.ts": "L\n", "src/a.ts": "A\n" } });
  const r = hotfixApply(fork, hot, "upstream/main");
  assert.equal(r.status, "picked");
  assert.deepEqual(r.leftOut, ["src/later.ts"]);
  assert.deepEqual(r.replaced, ["src/a.ts"]);
  assert.match(ledgerNotes(r), /left-out: src\/later\.ts/);
});

test("消す変更: 触っていなければ消す、fork が消していれば何もしない", () => {
  const { fork, hot } = small({ files: { "src/a.ts": "a\n", "src/b.ts": "b\n" }, hot: { "src/a.ts": null, "src/b.ts": null }, gone: ["src/b.ts"] });
  const r = hotfixApply(fork, hot, "upstream/main");
  assert.equal(r.status, "picked");
  assert.deepEqual(r.replaced, ["src/a.ts"]);
  assert.equal(git(fork, "ls-files", "src").trim(), "");
});

test("前の先取り(台帳の picked:)の版と同じ中身は触っていないとみなして置き換える", () => {
  const { up, fork, hot: first } = small({ files: { "src/a.ts": "v0\n" }, between: { "src/a.ts": "v1\n" }, hot: { "src/a.ts": "v2\n" } });
  // fork は first を先に取った(v2)。次の緊急修正 v3
  assert.equal(hotfixApply(fork, first, "upstream/main").status, "picked");
  write(fork, ".notices/applied/f.md", `# APPLIED\n- id:x | date:x | commit:- | upstream:- | picked:${first}\n`);
  commit(fork, "ledger");
  write(up, "src/a.ts", "v3\n");
  const second = commit(up, "fix 2");
  git(fork, "fetch", "-q", "upstream");
  const r = hotfixApply(fork, second, "upstream/main");
  assert.equal(r.status, "picked");
  assert.deepEqual(r.replaced, ["src/a.ts"]);
  assert.equal(read(fork, "src/a.ts"), "v3\n");
});

test("当てた後の確かめ: 足りない pnpm の命令・名指したパスを gap に出す(止めない)", () => {
  const notice = "# DOWNSTREAM NOTICE id:20261120-000001-g\nhotfix: t\nrequired_actions:\n1. Run `pnpm nothere` and read `src/missing.ts`.\nverify: v\nrefs: -\n";
  const { fork, hot } = small({ files: { "src/a.ts": "a\n", "package.json": '{"scripts":{}}\n' }, hot: { "src/a.ts": "A\n", ".notices/20261120-000001-g.md": notice } });
  const r = hotfixApply(fork, hot, "upstream/main");
  assert.equal(r.status, "picked");
  assert.deepEqual(r.gaps.map((g) => `${g.kind} ${g.item}`).sort(), ["paths src/missing.ts", "scripts nothere"]);
  assert.match(ledgerNotes(r), /gap: /);
});

test("当てた後の確かめ: 足したコードの相対 import 先が fork の木に無ければ gap imports(全部無ければ先取りしても動かない)", () => {
  const { fork, hot } = small({
    files: { "src/a.ts": "a\n" },
    between: { "src/lib.mjs": "export const a = 1;\n" },
    hot: { "src/tool.mjs": 'import { a } from "./lib.mjs";\nimport { b } from "./self.mjs";\nexport const t = 1;\n', "src/a.ts": 'import { t } from "./tool.mjs";\nimport { n } from "./none";\n' },
  });
  const r = hotfixApply(fork, hot, "upstream/main");
  assert.equal(r.status, "picked");
  assert.deepEqual(r.gaps.filter((g) => g.kind === "imports").map((g) => g.item).sort(), ["src/a.ts -> ./none", "src/tool.mjs: 先取りしても動かない(import 先が fork に無い: ./lib.mjs, ./self.mjs)"]);
});

test("当てた後の確かめ: 当てたコードが読む lib・当てた lib の package.json の libs が fork の木に無ければ gap libs(メサ F50: 先の緊急修正で入る pageLeave)", () => {
  const { fork, hot } = small({
    files: { "src/lib/seamlessVideo/package.json": '{ "libs": ["cn"] }\n', "src/lib/seamlessVideo/hooks/useSeamlessReel.ts": "a\n", "src/lib/cn/index.ts": "x\n", "src/components/Dialog.tsx": "d\n" },
    between: { "src/lib/pageLeave/index.ts": "export const useOnPageLeave = 1;\n" },
    hot: {
      "src/lib/seamlessVideo/package.json": '{ "libs": ["cn", "pageLeave"] }\n',
      "src/lib/seamlessVideo/hooks/useSeamlessReel.ts": 'import { cn } from "@/lib/cn";\nimport { useOnPageLeave } from "@/lib/pageLeave";\n',
      "src/components/Dialog.tsx": 'import { useOnPageLeave } from "@/lib/pageLeave";\n',
    },
  });
  const r = hotfixApply(fork, hot, "upstream/main");
  assert.equal(r.status, "picked");
  assert.deepEqual(r.gaps.filter((g) => g.kind === "libs").map((g) => g.item).sort(), [
    "src/components/Dialog.tsx -> @/lib/pageLeave(lib が fork に無い)",
    "src/lib/seamlessVideo/hooks/useSeamlessReel.ts -> @/lib/pageLeave(lib が fork に無い)",
    "src/lib/seamlessVideo/package.json: libs の pageLeave が fork に無い",
  ]);
  assert.match(ledgerNotes(r), /gap: .*pageLeave/);
});

test("ledgerPickedIds: 台帳の picked: の付いた行の id だけ(HEAD の版)", () => {
  const repo = join(root, `ledger${++n}`);
  mkdirSync(repo);
  git(repo, "init", "-q", "-b", "main");
  write(repo, ".notices/applied/f.md", "# APPLIED\n- id:20261120-000000-hot | date:x | commit:abc1234 | upstream:- | picked:0123456789abcdef0123456789abcdef01234567 | notes:hotfix pick\n- id:20261120-000001-plain | date:x | commit:abc1235 | upstream:- | notes:-\n");
  commit(repo, "ledger");
  write(repo, ".notices/applied/f.md", "# APPLIED\n- id:20261120-000002-later | date:x | commit:- | upstream:- | picked:0123456\n");
  assert.deepEqual(ledgerPickedIds(repo), ["20261120-000000-hot"]);
});

test("mergeText: ぶつかれば ok: false", () => {
  assert.deepEqual(mergeText("a\n", "b\n", "c\n"), { ok: false });
  assert.equal(mergeText("x\n2\n3\n", "1\n2\n3\n", "1\n2\nY\n").text, "x\n2\nY\n");
});
