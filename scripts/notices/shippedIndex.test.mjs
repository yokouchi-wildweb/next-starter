// scripts/notices/shippedIndex.test.mjs — 索引 .notices/shipped/<fork_id>.md の行の書式と、add / backfill / verify を小さなリポで通す。実行: pnpm test:notices
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { formatRow, parseIndex, parseRow, rowFieldsFromNotice, rowFromNotice, run, writeRowPick } from "./shippedIndex.mjs";

function notice(id, extra = []) {
  return [`# DOWNSTREAM NOTICE id:${id}`, "from: up", "date: x", "severity: info", ...extra, "change: c", "why: w", "required_actions: none", "verify: v", "refs: -", "notes: -", ""].join("\n");
}

/** 小さなリポ(fork_id: up)。commit(files, msg) → sha */
function repo(t) {
  const dir = mkdtempSync(join(tmpdir(), "shipped-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const g = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  g("init", "-q", "-b", "main");
  g("config", "user.email", "t@t");
  g("config", "user.name", "t");
  const put = (files) => {
    for (const [f, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, f)), { recursive: true });
      writeFileSync(join(dir, f), text);
    }
  };
  const commit = (files, msg = "c") => {
    put(files);
    g("add", "-A");
    g("commit", "-qm", msg);
    return g("rev-parse", "HEAD");
  };
  commit({ ".claude/rules/project.md": "fork_id: up\n" }, "base");
  return { dir, g, put, commit };
}

const quiet = () => {};
const rows = (dir, name = "up") => readFileSync(join(dir, `.notices/shipped/${name}.md`), "utf8").split("\n").filter((l) => l.startsWith("- id:"));

test("row: fixed key order, only the fields the notice has, hotfix → yes, reads back the same", () => {
  const text = notice("20990101-000001-a", ["pick: clean", "fixes: 20990101-000000-z, commit:abc1234", "checkpoint: a", "hotfix: a fork behind needs this now", "moved: a.ts -> b.ts; c/ -> d/", "uses: .notices/20990101-000001-a.fix.mjs"]);
  const row = rowFromNotice(text);
  assert.equal(row, "- id:20990101-000001-a | severity:info | checkpoint:a | moved:a.ts -> b.ts; c/ -> d/ | fixes:20990101-000000-z, commit:abc1234 | hotfix:yes | uses:.notices/20990101-000001-a.fix.mjs | pick:clean");
  assert.deepEqual(parseRow(row), rowFieldsFromNotice(text));
  // checkpoint: の欄が無い古い notice は行でも欄を省く(- を写すと区切りでない意味に変わる)
  assert.equal(rowFromNotice(notice("20990101-000002-b")), "- id:20990101-000002-b | severity:info");
  assert.equal(parseRow("# SHIPPED up"), null);
});

test("row: a value with ' | ' or no heading is refused", () => {
  assert.throws(() => rowFromNotice(notice("20990101-000001-a", ["checkpoint: a | b"])), /" \| "/);
  assert.throws(() => rowFromNotice("severity: info\n"), /見出し/);
  assert.throws(() => formatRow({ id: "x", fields: { covers: "a\nb" } }), /改行/);
});

test("writeRowPick: sets pick: on that row only, null when the row is missing", () => {
  const text = `# SHIPPED up\n\n- id:a | severity:info | fixes:z\n- id:b | severity:info\n`;
  const next = writeRowPick(text, "a", "clean");
  assert.deepEqual(parseIndex(next).map((r) => r.fields.pick), ["clean", undefined]);
  assert.equal(parseIndex(writeRowPick(next, "a", "-"))[0].fields.pick, "-");
  assert.equal(writeRowPick(text, "c", "clean"), null);
});

test("add: appends to the own fork's index, a second row for the same id is refused", (t) => {
  const r = repo(t);
  r.put({ ".notices/20990101-000001-a.md": notice("20990101-000001-a", ["checkpoint: a"]), ".notices/20990101-000002-b.md": notice("20990101-000002-b", ["checkpoint: -"]) });
  assert.equal(run(r.dir, ["add", ".notices/20990101-000001-a.md"], quiet), 0);
  assert.equal(run(r.dir, ["add", ".notices/20990101-000002-b.md"], quiet), 0);
  assert.deepEqual(rows(r.dir), ["- id:20990101-000001-a | severity:info | checkpoint:a", "- id:20990101-000002-b | severity:info | checkpoint:-"]);
  const out = [];
  assert.equal(run(r.dir, ["add", ".notices/20990101-000001-a.md"], (l) => out.push(l)), 2);
  assert.match(out.join("\n"), /既にある/);
  assert.equal(rows(r.dir).length, 2);
  assert.equal(existsSync(join(r.dir, ".notices/shipped")) && execFileSync("ls", [join(r.dir, ".notices/shipped")], { encoding: "utf8" }).trim(), "up.md");
});

test("add: no fork_id → refused, nothing written", (t) => {
  const r = repo(t);
  r.put({ ".claude/rules/project.md": "# no id\n", ".notices/20990101-000001-a.md": notice("20990101-000001-a") });
  assert.equal(run(r.dir, ["add", ".notices/20990101-000001-a.md"], quiet), 2);
  assert.equal(existsSync(join(r.dir, ".notices/shipped")), false);
});

test("backfill: every notice (done/ too) in the order its first add commit came, same commit by id; verify agrees", (t) => {
  const r = repo(t);
  r.commit({ ".notices/20990101-000003-c.md": notice("20990101-000003-c") });
  r.commit({ ".notices/20990101-000002-b.md": notice("20990101-000002-b", ["checkpoint: b"]), ".notices/20990101-000001-a.md": notice("20990101-000001-a", ["checkpoint: a"]) });
  r.commit({ ".notices/20990101-000004-d.md": notice("20990101-000004-d", ["checkpoint: d"]) });
  mkdirSync(join(r.dir, ".notices/done"), { recursive: true });
  r.g("mv", ".notices/20990101-000003-c.md", ".notices/done/20990101-000003-c.md");
  r.g("commit", "-qm", "archive");
  assert.equal(run(r.dir, ["backfill"], quiet), 0);
  assert.deepEqual(rows(r.dir).map((l) => parseRow(l).id), ["20990101-000003-c", "20990101-000001-a", "20990101-000002-b", "20990101-000004-d"]);
  assert.equal(run(r.dir, ["verify"], quiet), 0);
  const out = [];
  assert.equal(run(r.dir, ["backfill"], (l) => out.push(l)), 2);
  assert.match(out.join("\n"), /既にある/);
});

test("backfill: a notice not committed yet, or a shallow clone, stops", (t) => {
  const r = repo(t);
  r.commit({ ".notices/20990101-000001-a.md": notice("20990101-000001-a") });
  r.commit({ "x.txt": "x" });
  r.put({ ".notices/20990101-000002-b.md": notice("20990101-000002-b") });
  const out = [];
  assert.equal(run(r.dir, ["backfill"], (l) => out.push(l)), 2);
  assert.match(out.join("\n"), /20990101-000002-b/);
  rmSync(join(r.dir, ".notices/20990101-000002-b.md"));
  const shallow = mkdtempSync(join(tmpdir(), "shipped-shallow-"));
  t.after(() => rmSync(shallow, { recursive: true, force: true }));
  execFileSync("git", ["clone", "-q", "--depth=1", `file://${r.dir}`, shallow], { stdio: "ignore" });
  const out2 = [];
  assert.equal(run(shallow, ["backfill"], (l) => out2.push(l)), 2);
  assert.match(out2.join("\n"), /浅い clone/);
});

test("verify: a field that differs, a notice without a row, two rows; a row whose notice was deleted is fine; pick: only on the row is fine", (t) => {
  const r = repo(t);
  r.put({
    ".notices/20990101-000001-a.md": notice("20990101-000001-a", ["checkpoint: a", "fixes: z"]),
    ".notices/20990101-000002-b.md": notice("20990101-000002-b", ["checkpoint: b"]),
    ".notices/shipped/up.md": "# SHIPPED up\n\n- id:20990101-000000-gone | severity:info\n- id:20990101-000001-a | severity:info | checkpoint:a | fixes:z | pick:clean\n",
  });
  assert.equal(run(r.dir, ["verify"], quiet), 1);
  r.put({ ".notices/shipped/up.md": readFileSync(join(r.dir, ".notices/shipped/up.md"), "utf8") + "- id:20990101-000002-b | severity:info | checkpoint:-\n- id:20990101-000002-b | severity:info | checkpoint:b\n" });
  const out = [];
  assert.equal(run(r.dir, ["verify"], (l) => out.push(l)), 1);
  const text = out.join("\n");
  assert.match(text, /20990101-000002-b: 行が 2 本ある/);
  assert.match(text, /checkpoint: 本文 b \/ 行 -/);
  assert.doesNotMatch(text, /gone|000001-a/);
});
