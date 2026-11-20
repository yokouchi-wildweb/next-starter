// scripts/workflow/notices/reorder.test.mjs — push の前の並べ替え(pnpm workflow notices reorder)を小さなリポで通す。実行: pnpm test scripts/workflow/notices/reorder.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { planReorder, run } from "./reorder.mjs";

const X = ".notices/20991120-000001-x.md";
const Y = ".notices/20991120-000002-y.md";
const notice = (id, extra = []) => [`# DOWNSTREAM NOTICE id:${id}`, "severity: info", `checkpoint: ${id.slice(16)}`, ...extra, "change: c", ""].join("\n");

function repo(t) {
  const dir = mkdtempSync(join(tmpdir(), "reorder-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const g = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  g("init", "-q", "-b", "main");
  g("config", "user.email", "t@t");
  g("config", "user.name", "t");
  const commit = (files, msg = "c") => {
    for (const [f, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, f)), { recursive: true });
      writeFileSync(join(dir, f), text);
    }
    g("add", "-A");
    g("commit", "-qm", msg);
    return g("rev-parse", "HEAD");
  };
  commit({ "a.txt": "0\n" }, "base");
  g("branch", "pushed");
  /** 先端から古い順に [{ subject, files: ["A\tpath", ...] }] */
  const log = () =>
    g("log", "--reverse", "--format=@%s", "--name-status", "pushed..HEAD")
      .split("@")
      .filter(Boolean)
      .map((chunk) => {
        const [subject, ...rest] = chunk.split("\n").filter(Boolean);
        return { subject, files: rest };
      });
  return { dir, g, commit, log };
}

const quiet = () => {};

test("足す → 直す → 直す: 足すのが最後に直した commit へ移り、先端の木・ほかのファイル・著者とメッセージはそのまま", (t) => {
  const r = repo(t);
  r.commit({ [X]: notice("20991120-000001-x", ["notes: v1"]), "src/a.ts": "1\n" }, "x add");
  r.commit({ [X]: notice("20991120-000001-x", ["notes: v2"]), "src/b.ts": "1\n" }, "x edit 1");
  r.commit({ [X]: notice("20991120-000001-x", ["notes: v3"]), "src/c.ts": "1\n" }, "x edit 2");
  const tree = r.g("rev-parse", "HEAD^{tree}");
  const out = [];
  assert.equal(run(r.dir, ["--onto=pushed"], (l) => out.push(l)), 0, out.join("\n"));
  assert.equal(r.g("rev-parse", "HEAD^{tree}"), tree);
  assert.deepEqual(r.log(), [
    { subject: "x add", files: ["A\tsrc/a.ts"] },
    { subject: "x edit 1", files: ["A\tsrc/b.ts"] },
    { subject: "x edit 2", files: [`A\t${X}`, "A\tsrc/c.ts"] },
  ]);
  assert.match(readFileSync(join(r.dir, X), "utf8"), /notes: v3/);
  assert.equal(r.g("status", "--short"), "");
  assert.match(out.join("\n"), /20991120-000001-x: 足す commit \w+ → \w+/);
});

test("--dry-run は書かない / 直しが無ければ何も無い", (t) => {
  const r = repo(t);
  r.commit({ [X]: notice("20991120-000001-x") }, "x add");
  const head = r.commit({ [X]: notice("20991120-000001-x", ["notes: v2"]) }, "x edit");
  const out = [];
  assert.equal(run(r.dir, ["--onto=pushed", "--dry-run"], (l) => out.push(l)), 0);
  assert.equal(r.g("rev-parse", "HEAD"), head);
  assert.match(out.join("\n"), /--dry-run/);
  const r2 = repo(t);
  const h2 = r2.commit({ [X]: notice("20991120-000001-x"), "src/a.ts": "1\n" }, "x add");
  r2.commit({ "src/a.ts": "2\n" }, "code only");
  const out2 = [];
  assert.equal(run(r2.dir, ["--onto=pushed"], (l) => out2.push(l)), 0);
  assert.match(out2.join("\n"), /動かす notice なし/);
  assert.equal(r2.g("rev-parse", "HEAD~1"), h2);
});

test("次の区切りを越えない: X の後に Y を足し、その後で X を直していれば X は動かさず 1 行で言う。Y の前だけの直しなら Y の前へ", (t) => {
  const r = repo(t);
  r.commit({ [X]: notice("20991120-000001-x") }, "x add");
  r.commit({ [X]: notice("20991120-000001-x", ["notes: v2"]) }, "x edit before y");
  r.commit({ [Y]: notice("20991120-000002-y") }, "y add");
  r.commit({ [X]: notice("20991120-000001-x", ["notes: v3"]) }, "x edit after y");
  const plan = planReorder(r.dir, "pushed");
  assert.deepEqual(plan.moves, []);
  assert.match(plan.skipped.join("\n"), /20991120-000001-x は次の区切りの後で直されています/);
  const r2 = repo(t);
  r2.commit({ [X]: notice("20991120-000001-x") }, "x add");
  r2.commit({ [X]: notice("20991120-000001-x", ["notes: v2"]) }, "x edit before y");
  r2.commit({ [Y]: notice("20991120-000002-y") }, "y add");
  assert.equal(run(r2.dir, ["--onto=pushed"], quiet), 0);
  assert.deepEqual(r2.log().map((c) => c.files), [[], [`A\t${X}`], [`A\t${Y}`]]);
});

test("動かさない: hotfix: の notice・範囲で消す本文・範囲に merge", (t) => {
  const r = repo(t);
  r.commit({ [X]: notice("20991120-000001-x", ["hotfix: urgent"]), "src/a.ts": "1\n" }, "hotfix");
  r.commit({ [X]: notice("20991120-000001-x", ["hotfix: urgent", "notes: v2"]) }, "edit");
  const p = planReorder(r.dir, "pushed");
  assert.deepEqual(p.moves, []);
  assert.match(p.skipped.join("\n"), /hotfix:/);
  const r2 = repo(t);
  r2.commit({ [X]: notice("20991120-000001-x") }, "x add");
  r2.commit({ [X]: notice("20991120-000001-x", ["notes: v2"]) }, "x edit");
  r2.g("rm", "-q", X);
  r2.g("commit", "-qm", "x removed");
  assert.match(planReorder(r2.dir, "pushed").skipped.join("\n"), /消す・改名/);
  const r3 = repo(t);
  r3.g("checkout", "-q", "-b", "side");
  r3.commit({ "s.txt": "s\n" }, "side");
  r3.g("checkout", "-q", "main");
  r3.commit({ [X]: notice("20991120-000001-x") }, "x add");
  r3.g("merge", "-q", "--no-edit", "side");
  r3.commit({ [X]: notice("20991120-000001-x", ["notes: v2"]) }, "x edit");
  const p3 = planReorder(r3.dir, "pushed");
  assert.equal(p3.merge, true);
  assert.deepEqual(p3.moves, []);
});

test("push 先が分からなければ exit 2", (t) => {
  const r = repo(t);
  const out = [];
  assert.equal(run(r.dir, [], (l) => out.push(l)), 2);
  assert.match(out.join("\n"), /push 先が分からない/);
});
