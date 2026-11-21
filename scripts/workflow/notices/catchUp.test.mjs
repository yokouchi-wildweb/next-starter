import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { editTodo, run } from "./catchUp.mjs";

const dirs = [];
after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const logs = () => {
  const lines = [];
  return { lines, log: (s) => lines.push(s) };
};

/** 1 ファイル 1 commit(ぶつからない形) */
function commit(dir, name) {
  writeFileSync(join(dir, `${name}.txt`), `${name}\n`);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", name);
  return git(dir, "rev-parse", "HEAD");
}

/** main: base → m1 → m2 / line: l1 → 作業の merge(craft: k1) → main(m1)を取り込んだ merge → l2 */
function repo() {
  const dir = mkdtempSync(join(tmpdir(), "catch-up-"));
  dirs.push(dir);
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.name", "t");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "commit.gpgSign", "false");
  commit(dir, "base");
  git(dir, "switch", "-q", "-c", "line");
  commit(dir, "l1");
  git(dir, "switch", "-q", "-c", "craft");
  commit(dir, "k1");
  git(dir, "switch", "-q", "line");
  git(dir, "merge", "-q", "--no-ff", "-m", "work merge", "craft");
  git(dir, "switch", "-q", "main");
  commit(dir, "m1");
  git(dir, "switch", "-q", "line");
  git(dir, "merge", "-q", "--no-ff", "-m", "merge main into line", "main");
  commit(dir, "l2");
  git(dir, "switch", "-q", "main");
  commit(dir, "m2");
  git(dir, "switch", "-q", "line");
  return dir;
}

test("editTodo: main を取り込んだ merge を消し、onto の祖先への reset を reset onto に、作業の merge は残す", () => {
  const todo = [
    "label onto",
    "reset 47f19d4 # base",
    "pick b0a19f4 l1",
    "label branch-point",
    "pick 34821a3 k1",
    "label work-merge",
    "reset branch-point # l1",
    "merge -C 604a895 work-merge # work merge",
    "merge -C 136838e onto # merge main into line",
    "merge -C 777aaaa 42fd63d # merge an older main",
    "pick 5a0552f l2",
  ].join("\n");
  const r = editTodo(todo, (ref) => ref === "47f19d4" || ref === "42fd63d");
  assert.deepEqual(r.text.split("\n"), [
    "label onto",
    "reset onto # base",
    "pick b0a19f4 l1",
    "label branch-point",
    "pick 34821a3 k1",
    "label work-merge",
    "reset branch-point # l1",
    "merge -C 604a895 work-merge # work merge",
    "pick 5a0552f l2",
  ]);
  assert.deepEqual(r.dropped, [
    { orig: "136838e", subject: "merge main into line" },
    { orig: "777aaaa", subject: "merge an older main" },
  ]);
  assert.deepEqual(r.kept, [{ orig: "604a895", subject: "work merge" }]);
});

test("catchUp: 作業の merge は残り、main を取り込んだ merge は消え、線は onto の上に同じ順。木は素の rebase と同じ", () => {
  const dir = repo();
  const l = logs();
  assert.equal(run(dir, ["--onto=main"], l.log), 0, l.lines.join("\n"));
  const fp = git(dir, "log", "--first-parent", "--format=%s %P", "main..HEAD").split("\n");
  assert.deepEqual(
    fp.map((s) => s.split(" ")[0] + (s.split(" ").length > 3 ? " (merge)" : "")),
    ["l2", "work (merge)", "l1"],
  );
  assert.equal(git(dir, "rev-parse", "HEAD~2^"), git(dir, "rev-parse", "main"));
  assert.equal(git(dir, "log", "--merges", "--format=%s", "main..HEAD"), "work merge");
  assert.deepEqual(git(dir, "ls-tree", "--name-only", "HEAD").split("\n"), ["base.txt", "k1.txt", "l1.txt", "l2.txt", "m1.txt", "m2.txt"]);
  assert.ok(l.lines.some((s) => s.includes("落とした合流") && s.includes("merge main into line")));
  assert.ok(l.lines.some((s) => s.includes("残した合流") && s.includes("work merge")));

  const again = logs();
  assert.equal(run(dir, ["--onto=main"], again.log), 0);
  assert.match(again.lines[0], /載せ直し不要/);
});
