// scripts/workflow/notices/noticeFields.test.mjs — 本文の欄どうしの検査(uses:・skip_checkpoint:・covers: の参照先・fixes: の前後)を小さなリポで通す。実行: pnpm test scripts/workflow/notices/noticeFields.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkCovers, checkFields, checkSkipCheckpoint, checkUses, fixesPointsBack, lastNoticeFields, noticeAddCommits } from "./noticeFields.mjs";

function notice(id, extra = []) {
  return [`# DOWNSTREAM NOTICE id:${id}`, "from: up", "date: x", "severity: info", ...extra, "change: c", "why: w", "required_actions: none", "verify: v", "refs: -", "notes: -", ""].join("\n");
}

/** 小さなリポ(repo_id up)。commit(files, msg) → sha */
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
  commit({ "repo.json": '{"repo_id": "up", "tier": "root"}\n' }, "base");
  return { dir, g, put, commit };
}

test("uses: paths exist in the adding commit, codemods are .notices/<id>.<name>.mjs, the notice is a checkpoint", () => {
  const row = (fields) => ({ id: "20990101-000001-a", fields: { severity: "info", checkpoint: "a", ...fields } });
  const have = new Set([".notices/20990101-000001-a.fix-imports.mjs", "src/domains/x/scripts/migrations/m1.ts"]);
  const exists = (p) => have.has(p);
  assert.deepEqual(checkUses(row({ uses: ".notices/20990101-000001-a.fix-imports.mjs, src/domains/x/scripts/migrations/m1.ts" }), exists), []);
  assert.deepEqual(checkUses(row({}), exists), []);
  const text = checkUses(row({ checkpoint: "-", uses: ".notices/other.fix.mjs, src/gone.ts" }), exists).join("\n");
  assert.match(text, /区切り/);
  assert.match(text, /\.notices\/20990101-000001-a\.<名前>\.mjs/);
  assert.match(text, /src\/gone\.ts が notice を足した commit に無い/);
  // a fix that replaces the tool of the notice it fixes (S32): the fixed notice's codemod counts as its own
  const fixHave = new Set([".notices/20990101-000000-o.fix-imports.mjs"]);
  const fix = { id: "20990101-000001-a", fields: { severity: "info", checkpoint: "a", fixes: "20990101-000000-o", uses: ".notices/20990101-000000-o.fix-imports.mjs" } };
  assert.deepEqual(checkUses(fix, (p) => fixHave.has(p)), []);
  const other = { ...fix, fields: { ...fix.fields, fixes: "20990101-000009-z" } };
  assert.match(checkUses(other, (p) => fixHave.has(p)).join("\n"), /fixes: が名指す notice/);
});

test("skip_checkpoint: only a fix that cannot be picked, on its own fixes: target with a label and no uses:, the fix itself a checkpoint", () => {
  const src = { id: "20990101-000001-a", fields: { severity: "info", checkpoint: "a" } };
  const withUses = { id: "20990101-000002-b", fields: { severity: "info", checkpoint: "b", uses: "src/m.ts" } };
  const dash = { id: "20990101-000003-c", fields: { severity: "info", checkpoint: "-" } };
  const byId = new Map([src, withUses, dash].map((r) => [r.id, r.fields]));
  const fix = (fields) => ({ id: "20990101-000009-f", fields: { severity: "info", checkpoint: "f", ...fields } });
  assert.deepEqual(checkSkipCheckpoint(fix({ fixes: src.id, skip_checkpoint: src.id, pick: "-" }), byId), []);
  assert.deepEqual(checkSkipCheckpoint(fix({ fixes: src.id, skip_checkpoint: src.id }), byId), []);
  const bad = checkSkipCheckpoint(fix({ checkpoint: "-", pick: "clean", fixes: withUses.id, skip_checkpoint: `${src.id}, ${withUses.id}, ${dash.id}, 20990101-000008-x` }), byId).join("\n");
  assert.match(bad, /自身は区切り/);
  assert.match(bad, /pick: clean/);
  assert.match(bad, /000001-a が fixes: に無い/);
  assert.match(bad, /000002-b は uses: を持つ/);
  assert.match(bad, /000003-c は checkpoint がラベルでない/);
  assert.match(bad, /000008-x の本文が履歴に無い/);
});

test("checkFields through a repo: uses: read from the adding commit's tree, an uncommitted notice from the working tree, skip_checkpoint: target read from the body deleted later", (t) => {
  const r = repo(t);
  r.commit({ ".notices/20990101-000001-a.md": notice("20990101-000001-a", ["checkpoint: a", "uses: .notices/20990101-000001-a.fix.mjs"]), ".notices/20990101-000001-a.fix.mjs": "x" });
  rmSync(join(r.dir, ".notices/20990101-000001-a.fix.mjs"));
  r.commit({}, "codemod removed after the run");
  assert.deepEqual(checkFields(r.dir), []);
  r.commit({ ".notices/20990101-000002-s.md": notice("20990101-000002-s", ["checkpoint: s"]) });
  rmSync(join(r.dir, ".notices/20990101-000002-s.md"));
  r.commit({}, "segment closed, body removed");
  assert.equal(lastNoticeFields(r.dir).get("20990101-000002-s").checkpoint, "s");
  r.put({ ".notices/20990101-000003-f.md": notice("20990101-000003-f", ["checkpoint: f", "fixes: 20990101-000002-s", "skip_checkpoint: 20990101-000002-s", "pick: -"]) });
  assert.deepEqual(checkFields(r.dir, { pending: new Set(["20990101-000003-f"]) }), []);
  r.put({ ".notices/20990101-000004-b.md": notice("20990101-000004-b", ["checkpoint: b", "uses: src/missing.ts"]) });
  assert.match(checkFields(r.dir, { pending: new Set(["20990101-000003-f", "20990101-000004-b"]) }).join("\n"), /src\/missing\.ts/);
});

test("covers: the covered id passes while its body is on disk or only in history (body deleted after the segment closed); an id in neither fails", (t) => {
  const row = { id: "20990101-000009-relay", fields: { checkpoint: "r", covers: "20990101-000001-a, 20990101-000002-gone" } };
  assert.deepEqual(checkCovers(row, new Map([["20990101-000001-a", {}], ["20990101-000002-gone", {}]])), []);
  assert.deepEqual(checkCovers({ id: "x", fields: {} }, new Map()), []);
  assert.match(checkCovers(row, new Map([["20990101-000001-a", {}]])).join("\n"), /covers: 20990101-000002-gone が .*履歴にもありません/);
  // 中間 Tier の形: 上流が notice を出し、区間が閉じて本文を消した後に、中継 notice が covers: で名指す
  const r = repo(t);
  r.commit({ ".notices/20990101-000001-s.md": notice("20990101-000001-s", ["checkpoint: s"]) });
  r.commit({ ".notices/20990101-000002-n.md": notice("20990101-000002-n", ["checkpoint: n"]) });
  rmSync(join(r.dir, ".notices/20990101-000001-s.md"));
  r.commit({}, "segment closed, body removed");
  r.put({ ".notices/20990101-000003-relay.md": notice("20990101-000003-relay", ["checkpoint: r", "covers: 20990101-000001-s, 20990101-000002-n"]) });
  assert.deepEqual(checkFields(r.dir, { pending: new Set(["20990101-000003-relay"]) }), []);
  r.put({ ".notices/20990101-000004-relay.md": notice("20990101-000004-relay", ["checkpoint: r2", "covers: 20990101-000008-never"]) });
  assert.match(checkFields(r.dir, { pending: new Set(["20990101-000003-relay", "20990101-000004-relay"]) }).join("\n"), /covers: 20990101-000008-never/);
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
  writeFileSync(join(fork, "repo.json"), '{"repo_id": "child", "tier": "leaf"}\n');
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

test("noticeAddCommits: 足した commit の表は HEAD ごと(HEAD が進めば新しい add を引ける)", (t) => {
  const r = repo(t);
  const a = r.commit({ ".notices/20990101-000001-a.md": notice("20990101-000001-a") });
  assert.deepEqual(noticeAddCommits(r.dir, "20990101-000001-a"), [a]);
  assert.deepEqual(noticeAddCommits(r.dir, "20990101-000002-b"), []);
  const b = r.commit({ ".notices/20990101-000002-b.md": notice("20990101-000002-b") });
  assert.deepEqual(noticeAddCommits(r.dir, "20990101-000002-b"), [b]);
  assert.deepEqual(noticeAddCommits(r.dir, "20990101-000001-a"), [a]);
});
