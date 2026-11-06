// scripts/workflow/notices/shippedIndex.test.mjs — 索引 .notices/shipped/<fork_id>.md の行の書式と、add / backfill / verify を小さなリポで通す。実行: pnpm test:notices
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkAll, checkAppendOnly, checkRows, checkSkipCheckpoint, checkUses, fixesPointsBack, foreignNoticeIds, formatRow, normalizeRepoUrl, parseIndex, parseRow, refresh, repair, rowFieldsFromNotice, rowFromNotice, run, writeRowPick } from "./shippedIndex.mjs";

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

const A = "- id:20990101-000001-a | severity:info | checkpoint:a";
const B = "- id:20990101-000002-b | severity:info | checkpoint:b";
const C = "- id:20990101-000003-c | severity:info | checkpoint:c";

test("append only: pushed rows stay first in the same order and text; new rows (pick: on them too) pass", () => {
  const prev = `# SHIPPED up\n\n${A}\n${B}\n`;
  assert.deepEqual(checkAppendOnly(prev, `# SHIPPED up\nnew header\n\n${A}\n${B}\n${C} | pick:clean\n`), []);
  assert.deepEqual(checkAppendOnly("", `${A}\n`), []);
  assert.match(checkAppendOnly(prev, `${A}\n${B} | pick:-\n`).join(), /000002-b: push 済みの行が変わった/);
  assert.match(checkAppendOnly(prev, `${A}\n`).join(), /000002-b: push 済みの行が変わった・消えた/);
  assert.match(checkAppendOnly(prev, `${B}\n${A}\n`).join(), /位置が変わった/);
});

test("append only through a repo: compared with the pushed ref, no ref → unverified", (t) => {
  const r = repo(t);
  const pushed = r.commit({ ".notices/shipped/up.md": `# SHIPPED up\n\n${A}\n` });
  r.put({ ".notices/shipped/up.md": `# SHIPPED up\n\n${B}\n` });
  assert.match(checkAll(r.dir, { ref: pushed }).problems.join("\n"), /000001-a: push 済みの行が変わった/);
  assert.match(checkAll(r.dir).unverified, /分からない/);
});

test("rows ↔ bodies across every index: one row per body in any repo's index, uncommitted notices in the own index", () => {
  const indexes = [
    { owner: "parent", file: ".notices/shipped/parent.md", rows: [parseRow(A)] },
    { owner: "up", file: ".notices/shipped/up.md", rows: [parseRow(B), parseRow(A)] },
  ];
  const notices = new Map([
    ["20990101-000001-a", notice("20990101-000001-a", ["checkpoint: a"])],
    ["20990101-000002-b", notice("20990101-000002-b", ["checkpoint: b"])],
    ["20990101-000003-c", notice("20990101-000003-c", ["checkpoint: c"])],
  ]);
  const text = checkRows({ indexes, notices, own: "up" }).join("\n");
  assert.match(text, /000001-a: 行が 2 本ある/);
  assert.match(text, /000003-c: 本文があるのに索引に行が無い/);
  const ok = [{ owner: "parent", file: ".notices/shipped/parent.md", rows: [parseRow(A), parseRow(C)] }, { owner: "up", file: ".notices/shipped/up.md", rows: [parseRow(B)] }];
  assert.deepEqual(checkRows({ indexes: ok, notices, own: "up" }), []);
  assert.match(checkRows({ indexes: ok, notices, own: "up", pending: new Set(["20990101-000003-c"]) }).join(), /自分の索引.*に無い/);
});

test("uses: paths exist in the adding commit, codemods are .notices/<id>.<name>.mjs, the notice is a checkpoint", () => {
  const row = (fields) => ({ id: "20990101-000001-a", fields: { severity: "info", checkpoint: "a", ...fields } });
  const have = new Set([".notices/20990101-000001-a.fix-imports.mjs", "src/features/x/scripts/migrations/m1.ts"]);
  const exists = (p) => have.has(p);
  assert.deepEqual(checkUses(row({ uses: ".notices/20990101-000001-a.fix-imports.mjs, src/features/x/scripts/migrations/m1.ts" }), exists), []);
  assert.deepEqual(checkUses(row({}), exists), []);
  const text = checkUses(row({ checkpoint: "-", uses: ".notices/other.fix.mjs, src/gone.ts" }), exists).join("\n");
  assert.match(text, /区切り/);
  assert.match(text, /\.notices\/20990101-000001-a\.<名前>\.mjs/);
  assert.match(text, /src\/gone\.ts が notice を足した commit に無い/);
});

test("skip_checkpoint: only a fix that cannot be picked, on its own fixes: target with a label and no uses:, the fix itself a checkpoint", () => {
  const src = { id: "20990101-000001-a", fields: { severity: "info", checkpoint: "a" } };
  const withUses = { id: "20990101-000002-b", fields: { severity: "info", checkpoint: "b", uses: "src/m.ts" } };
  const dash = { id: "20990101-000003-c", fields: { severity: "info", checkpoint: "-" } };
  const byId = new Map([src, withUses, dash].map((r) => [r.id, r]));
  const fix = (fields) => ({ id: "20990101-000009-f", fields: { severity: "info", checkpoint: "f", ...fields } });
  assert.deepEqual(checkSkipCheckpoint(fix({ fixes: src.id, skip_checkpoint: src.id, pick: "-" }), byId), []);
  assert.deepEqual(checkSkipCheckpoint(fix({ fixes: src.id, skip_checkpoint: src.id }), byId), []);
  const bad = checkSkipCheckpoint(fix({ checkpoint: "-", pick: "clean", fixes: withUses.id, skip_checkpoint: `${src.id}, ${withUses.id}, ${dash.id}, 20990101-000008-x` }), byId).join("\n");
  assert.match(bad, /自身は区切り/);
  assert.match(bad, /pick: clean/);
  assert.match(bad, /000001-a が fixes: に無い/);
  assert.match(bad, /000002-b は uses: を持つ/);
  assert.match(bad, /000003-c は checkpoint がラベルでない/);
  assert.match(bad, /000008-x の行が索引に無い/);
});

test("checkAll through a repo: uses: read from the adding commit's tree, an uncommitted notice from the working tree", (t) => {
  const r = repo(t);
  r.commit({ ".notices/20990101-000001-a.md": notice("20990101-000001-a", ["checkpoint: a", "uses: .notices/20990101-000001-a.fix.mjs"]), ".notices/20990101-000001-a.fix.mjs": "x" });
  r.put({ ".notices/shipped/up.md": `# SHIPPED up\n\n- id:20990101-000001-a | severity:info | checkpoint:a | uses:.notices/20990101-000001-a.fix.mjs\n` });
  r.commit({});
  rmSync(join(r.dir, ".notices/20990101-000001-a.fix.mjs"));
  r.commit({}, "codemod removed after the run");
  assert.deepEqual(checkAll(r.dir, { ref: null }).problems, []);
  r.put({ ".notices/20990101-000002-b.md": notice("20990101-000002-b", ["checkpoint: b", "uses: src/missing.ts"]) });
  assert.equal(run(r.dir, ["add", ".notices/20990101-000002-b.md"], quiet), 0);
  assert.match(checkAll(r.dir, { ref: null }).problems.join("\n"), /src\/missing\.ts/);
});

test("backfill in a fork: notices on the parent's index are left out", (t) => {
  const r = repo(t);
  r.commit({ ".notices/20990101-000001-a.md": notice("20990101-000001-a", ["checkpoint: a"]), ".notices/shipped/parent.md": `# SHIPPED parent\n\n${A}\n` });
  r.commit({ ".notices/20990101-000002-b.md": notice("20990101-000002-b", ["checkpoint: b"]) });
  assert.equal(run(r.dir, ["backfill"], quiet), 0);
  assert.deepEqual(rows(r.dir), [B]);
  assert.equal(run(r.dir, ["verify"], quiet), 0);
});

test("refresh: an unpushed own row is rebuilt from the body (skip_checkpoint added after pick-check), pick: on the row kept", (t) => {
  const r = repo(t);
  const pushed = r.commit({ ".notices/shipped/up.md": `# SHIPPED up\n\n${A}\n` });
  const fix = "20990101-000009-f";
  r.put({ [`.notices/${fix}.md`]: notice(fix, ["checkpoint: f", "fixes: 20990101-000001-a"]) });
  assert.equal(run(r.dir, ["add", `.notices/${fix}.md`], quiet), 0);
  r.put({ ".notices/shipped/up.md": writeRowPick(readFileSync(join(r.dir, ".notices/shipped/up.md"), "utf8"), fix, "-") });
  r.put({ [`.notices/${fix}.md`]: notice(fix, ["checkpoint: f", "fixes: 20990101-000001-a", "skip_checkpoint: 20990101-000001-a"]) });
  assert.deepEqual(refresh(r.dir, [`.notices/${fix}.md`], pushed), [`- id:${fix} | severity:info | checkpoint:f | fixes:20990101-000001-a | pick:- | skip_checkpoint:20990101-000001-a`]);
  assert.equal(rows(r.dir)[0], A);
  assert.deepEqual(checkAll(r.dir, { ref: pushed }).problems.filter((p) => p.includes(fix)), []);
});

test("refresh: a pushed row, a missing row or an unknown pushed version is refused", (t) => {
  const r = repo(t);
  r.put({ ".notices/20990101-000001-a.md": notice("20990101-000001-a", ["checkpoint: a"]) });
  assert.equal(run(r.dir, ["add", ".notices/20990101-000001-a.md"], quiet), 0);
  const pushed = r.commit({});
  assert.throws(() => refresh(r.dir, [".notices/20990101-000001-a.md"], pushed), /push 済みの行/);
  r.put({ ".notices/20990101-000002-b.md": notice("20990101-000002-b", ["checkpoint: b"]) });
  assert.throws(() => refresh(r.dir, [".notices/20990101-000002-b.md"], pushed), /行が無い/);
  const out = [];
  assert.equal(run(r.dir, ["refresh", ".notices/20990101-000002-b.md"], (l) => out.push(l)), 2);
  assert.match(out.join(), /分からない/);
});

// 親から先に pick した fork の形(受信箱 20261105-140157・20261106-162044):
// 親 = up、fork = child。親が修正元 S を出し、fork が S の commit を cherry-pick(台帳 picked:)、親が S の修正 F(fixes: S)を出し、fork が親を merge
const UP = "git@github.com:acme/up.git";
const noticeFrom = (id, from, extra = []) => notice(id, extra).replace("from: up", `from: ${from} | branch:main | commit:-`);

function pickShaped(t) {
  const up = repo(t);
  const S = "20990101-000001-src";
  const F = "20990101-000003-fix";
  const sha = up.commit({ [`.notices/${S}.md`]: noticeFrom(S, UP, ["checkpoint: s", "hotfix: yes"]), "src/a.ts": "a2\n" }, "src");
  const fork = mkdtempSync(join(tmpdir(), "shipped-fork-"));
  t.after(() => rmSync(fork, { recursive: true, force: true }));
  const g = (...a) => execFileSync("git", ["-C", fork, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  g("init", "-q", "-b", "main");
  g("config", "user.email", "t@t");
  g("config", "user.name", "t");
  g("remote", "add", "upstream", up.dir);
  g("fetch", "-q", "upstream");
  g("reset", "-q", "--hard", `${sha}~1`);
  g("remote", "add", "origin", "git@github.com:acme/child.git");
  writeFileSync(join(fork, ".claude/rules/project.md"), "fork_id: child\n");
  g("add", "-A");
  g("commit", "-qm", "fork start");
  g("cherry-pick", "-x", sha);
  mkdirSync(join(fork, ".notices/applied"), { recursive: true });
  writeFileSync(join(fork, ".notices/applied/child.md"), `# APPLIED LEDGER\n- id:${S} | date:x | commit:- | upstream:${sha.slice(0, 9)} | picked:${sha}\n`);
  g("add", "-A");
  g("commit", "-qm", "ledger");
  up.commit({ [`.notices/${F}.md`]: noticeFrom(F, UP, ["checkpoint: f", `fixes: ${S}`]), "src/a.ts": "a3\n" }, "fix");
  return { up, fork, g, S, F };
}

test("fixes: の前後: 親から先に pick した fork でも、後から届いた修正の fixes: を通す(上流の元の add が祖先)。前を指す fixes: は止める", (t) => {
  const { fork, g, S, F } = pickShaped(t);
  g("fetch", "-q", "upstream");
  g("merge", "-q", "--no-edit", "-X", "theirs", "upstream/main");
  assert.equal(fixesPointsBack(fork, S, F), true);
  assert.equal(fixesPointsBack(fork, F, S), false);
  // pick していない普通の履歴: 前は通り、後ろ(未来)を指せば止まる
  const r = repo(t);
  r.commit({ ".notices/20990101-000001-a.md": notice("20990101-000001-a") });
  r.commit({ ".notices/20990101-000002-b.md": notice("20990101-000002-b") });
  assert.equal(fixesPointsBack(r.dir, "20990101-000001-a", "20990101-000002-b"), true);
  assert.equal(fixesPointsBack(r.dir, "20990101-000002-b", "20990101-000001-a"), false);
  // 修正の notice が未 commit: 参照先が commit 済みなら通す、参照先も未 commit なら止める
  r.put({ ".notices/20990101-000009-new.md": notice("20990101-000009-new") });
  assert.equal(fixesPointsBack(r.dir, "20990101-000002-b", "20990101-000009-new"), true);
  assert.equal(fixesPointsBack(r.dir, "20990101-000008-nope", "20990101-000009-new"), false);
});

test("backfill / repair: 親から先に pick した notice(from: が自分の origin でない・台帳に picked:)は自分の索引に書かない。紛れた行は repair が消し、追記だけの検査は消したその行を受け入れる(自分の行は今どおり)", (t) => {
  assert.equal(normalizeRepoUrl("git@github.com:Acme/Up.git"), normalizeRepoUrl("https://github.com/acme/up/"));
  const { fork, g, S } = pickShaped(t);
  const own = "20990101-000002-own";
  writeFileSync(join(fork, `.notices/${own}.md`), noticeFrom(own, "git@github.com:acme/child.git", ["checkpoint: o"]));
  g("add", "-A");
  g("commit", "-qm", "own");
  assert.deepEqual([...foreignNoticeIds(fork, "child")], [S]);
  assert.equal(run(fork, ["backfill"], quiet), 0);
  assert.deepEqual(rows(fork, "child").map((l) => parseRow(l).id), [own]);
  // 古い backfill が書いてしまった fork: S の行を前に push した版に持つ
  const rowS = formatRow(rowFieldsFromNotice(noticeFrom(S, UP, ["checkpoint: s", "hotfix: yes"])));
  const rowOwn = rows(fork, "child")[0];
  const pushed = `# SHIPPED child\n\n${rowS}\n${rowOwn}\n`;
  const removable = foreignNoticeIds(fork, "child");
  assert.deepEqual(checkAppendOnly(pushed, `# SHIPPED child\n\n${rowOwn}\n`, "child.md", removable), []);
  assert.equal(checkAppendOnly(pushed, `# SHIPPED child\n\n${rowS}\n`, "child.md", removable).length, 1, "自分の行が消えたら止める");
  writeFileSync(join(fork, ".notices/shipped/child.md"), pushed);
  assert.deepEqual(repair(fork), [S]);
  assert.deepEqual(rows(fork, "child").map((l) => parseRow(l).id), [own]);
  assert.deepEqual(repair(fork), [], "2 回目は何もしない");
  // 親の索引が同じ id を持ち込んでも 2 本にならない
  g("fetch", "-q", "upstream");
  mkdirSync(join(fork, ".notices/shipped"), { recursive: true });
  writeFileSync(join(fork, ".notices/shipped/up.md"), `# SHIPPED up\n\n${rowS}\n`);
  assert.deepEqual(checkRows({ indexes: [{ owner: "up", file: ".notices/shipped/up.md", rows: parseIndex(readFileSync(join(fork, ".notices/shipped/up.md"), "utf8")) }, { owner: "child", file: ".notices/shipped/child.md", rows: parseIndex(readFileSync(join(fork, ".notices/shipped/child.md"), "utf8")) }], notices: new Map(), own: "child" }).filter((p) => p.includes("2 本")), []);
});
