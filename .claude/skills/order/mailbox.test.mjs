// mailbox.mjs の resolve（指令に答える共通の書き手）と from（発行元の書き方・読み方）の契約テスト。
// 実行: pnpm test:order-mailbox （node:test。一時ディレクトリに受信箱と git リポジトリを作って確かめる。追加依存なし）
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fromLine, requester, resolveOrder } from "./mailbox.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "mailbox.mjs");
const BY = { repoId: "acme--app", origin: "git@x:Acme/App.git", branch: "main", commit: "abc1234", pushed: "yes" };
const BODY = "implemented: did x\nconsume: -\npropagate: -\nnotice: -\nnotes: -\n";

function box(from = "git@x:Acme/App.git | branch:main") {
  const dir = join(mkdtempSync(join(tmpdir(), "mailbox-")), "acme--app");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "20260101-000000-x.md");
  writeFileSync(file, `# ORDER id:20260101-000000-x\nfrom: ${from}\nstatus: open\nneed: do x\n`);
  return { dir, file };
}

test("done: RESOLUTION を追記して done/ へ移す（/wen・council collect が読む形）", () => {
  const { dir, file } = box();
  const dest = resolveOrder(file, { status: "done", body: BODY, by: BY, now: "2026-01-01T00:00:00+09:00" });
  assert.equal(dest, join(dir, "done", "20260101-000000-x.md"));
  assert.equal(existsSync(file), false);
  const text = readFileSync(dest, "utf8");
  assert.match(text, /\nneed: do x\n\n## RESOLUTION\nresolved: 2026-01-01T00:00:00\+09:00   status: done\n/);
  assert.match(text, /\nby: acme--app \| git@x:Acme\/App\.git \| branch:main \| commit:abc1234 \| pushed:yes\nimplemented: did x\n/);
  assert.match(text, /\nnotes: -\n$/);
  assert.match(text, /^# ORDER id:20260101-000000-x\nfrom: .*\nstatus: done\nneed: do x\n/);
});

test("先頭の status: は RESOLUTION の status に揃う（partial / relayed / rejected / withdrawn も）", () => {
  const head = (p) => readFileSync(p, "utf8").match(/^status: (\S+)$/m)[1];
  const p = box("council q1 | legate:l1 order:01");
  assert.equal(head(resolveOrder(p.file, { status: "partial", body: `${BODY}findings: x\nverify: y\n`, by: BY })), "partial");
  const r = box();
  assert.equal(head(resolveOrder(r.file, { status: "relayed", body: "relayed_to: o/1.md\nnotes: n\n", by: BY })), "relayed");
  const j = box();
  assert.equal(head(resolveOrder(j.file, { status: "rejected", body: "notes: n\n", by: BY })), "rejected");
  const w = box();
  assert.equal(head(resolveOrder(w.file, { status: "withdrawn", body: "notes: n\n", by: BY })), "withdrawn");
});

test("先頭に status: が無い古い指令は date: の次に足す。本文中の status: には触らない", () => {
  const { file } = box();
  writeFileSync(file, "# ORDER id:20260101-000000-x\nfrom: git@x:Acme/App.git\ndate: 2026-01-01T00:00:00Z\nneed: do x\n## BODY\nstatus: keep\n");
  const text = readFileSync(resolveOrder(file, { status: "done", body: BODY, by: BY }), "utf8");
  assert.match(text, /\ndate: 2026-01-01T00:00:00Z\nstatus: done\nneed: do x\n## BODY\nstatus: keep\n/);
});

test("done: 要る行が無ければ何も書かずに止める", () => {
  const { file } = box();
  assert.throws(() => resolveOrder(file, { status: "done", body: "implemented: x\n", by: BY }), /consume: propagate: notice: notes:/);
  assert.equal(readFileSync(file, "utf8").includes("RESOLUTION"), false);
});

test("評議会からの指令の done は findings / verify も要る", () => {
  const { file } = box("council q1 | legate:l1 order:01");
  assert.throws(() => resolveOrder(file, { status: "done", body: BODY, by: BY }), /findings: verify:/);
  const dest = resolveOrder(file, { status: "partial", body: `${BODY}findings: none\nverify: ran x\n`, by: BY });
  assert.match(readFileSync(dest, "utf8"), /status: partial\n[\s\S]*\nverify: ran x\n$/);
});

test("done は --pushed が要る", () => {
  const { file } = box();
  assert.throws(() => resolveOrder(file, { status: "done", body: BODY, by: { ...BY, pushed: undefined } }), /--pushed/);
});

test("relayed / rejected / withdrawn: 短い by 行と、それぞれの要る行", () => {
  const a = box();
  const dest = resolveOrder(a.file, { status: "relayed", body: "relayed_to: other--repo/1.md\nnotes: theirs\n", by: BY });
  assert.match(readFileSync(dest, "utf8"), /status: relayed\nby: acme--app \| commit:- \| pushed:-\nrelayed_to: other--repo\/1\.md\n/);
  const b = box();
  assert.throws(() => resolveOrder(b.file, { status: "rejected", body: "\n", by: BY }), /notes:/);
  resolveOrder(b.file, { status: "withdrawn", body: "notes: no longer needed\n", by: BY });
});

test("知らない status・done/ の指令・二度目の RESOLUTION は断る", () => {
  const { file } = box();
  assert.throws(() => resolveOrder(file, { status: "ok", body: BODY, by: BY }), /--status/);
  const dest = resolveOrder(file, { status: "withdrawn", body: "notes: x\n", by: BY });
  assert.throws(() => resolveOrder(dest, { status: "withdrawn", body: "notes: x\n", by: BY }), /done\//);
  const c = box();
  writeFileSync(c.file, readFileSync(c.file, "utf8") + "\n## RESOLUTION\nresolved: x\n");
  assert.throws(() => resolveOrder(c.file, { status: "withdrawn", body: "notes: x\n", by: BY }), /すでに RESOLUTION/);
});

test("CLI: by の repo-id・branch・commit は実行したリポから取る", () => {
  const repo = mkdtempSync(join(tmpdir(), "mailbox-repo-"));
  const run = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: repo, encoding: "utf8" }).trim();
  run("init", "-q", "-b", "main");
  run("remote", "add", "origin", "git@github.com:Acme/App.git");
  run("commit", "-q", "--allow-empty", "-m", "x");
  const sha = run("rev-parse", "--short", "HEAD");
  const { file } = box();
  const bodyFile = join(repo, "..", `body-${process.pid}.md`);
  writeFileSync(bodyFile, BODY);
  const out = execFileSync("node", [SCRIPT, "resolve", file, "--status=done", `--body=${bodyFile}`, "--pushed=no (no remote)"], { cwd: repo, encoding: "utf8" });
  assert.match(out, /^resolved: .*\/done\/20260101-000000-x\.md\n$/);
  const text = readFileSync(join(dirname(file), "done", "20260101-000000-x.md"), "utf8");
  assert.match(text, new RegExp(`\\nby: acme--app \\| git@github\\.com:Acme/App\\.git \\| branch:main \\| commit:${sha} \\| pushed:no \\(no remote\\)\\n`));
  const bad = box();
  assert.throws(() => execFileSync("node", [SCRIPT, "resolve", bad.file, "--status=done", `--body=${bodyFile}`], { cwd: repo, stdio: "pipe" }));
  assert.equal(existsSync(bad.file), true);
});

test("from: チームのタブでは発行元 = そのチーム、リポは repo: に残す", () => {
  const where = { origin: "git@x:Acme/App.git", repoId: "acme--app", branch: "main", cwd: "/w/app" };
  assert.equal(fromLine({}, where), "git@x:Acme/App.git | branch:main | cwd:/w/app");
  assert.equal(fromLine({}, { ...where, origin: "" }), "acme--app | branch:main | cwd:/w/app");
  const tab = { TK_TEAM: "fleet", TK_INSTANCE: "20261024-220119", TK_ROLE: "orchestrator", TK_LABEL: "Admiral" };
  assert.equal(fromLine(tab, where), "fleet 20261024-220119 | role:Admiral | repo:git@x:Acme/App.git | branch:main | cwd:/w/app");
  const { TK_LABEL, ...old } = tab;   // TK_LABEL を渡す前に起動したタブは役職 id
  assert.match(fromLine(old, where), /^fleet 20261024-220119 \| role:orchestrator \| /);
});

test("requester: 先頭が発行元。council（legate）/ team / repo を見分ける", () => {
  assert.deepEqual(requester("git@x:Acme/App.git | branch:main | cwd:/w/app"), { kind: "repo", label: "git@x:Acme/App.git", repo: "git@x:Acme/App.git" });
  assert.deepEqual(requester("council q1 | legate:l1 order:01"), { kind: "council", label: "council q1", repo: null });
  assert.deepEqual(requester("council q1 | instance:i1 | cwd:/w/app").kind, "council");
  assert.deepEqual(requester("guild g1 | role:Architect | repo:git@x:Acme/App.git | branch:main | cwd:/w/app"), { kind: "team", label: "guild g1 Architect", repo: "git@x:Acme/App.git" });
  // 評議会のタブ（議長など）が /order で書いた指令は legate のものではない: findings / verify は要らない
  assert.equal(requester("council c1 | role:Chair | repo:git@x:Acme/App.git").kind, "team");
  const { file } = box("council c1 | role:Chair | repo:git@x:Acme/App.git | branch:main | cwd:/w/app");
  resolveOrder(file, { status: "done", body: BODY, by: BY });
});

test("CLI: from はチームの環境変数を読み、inbox の一覧は発行元の名前を出す", () => {
  const repo = mkdtempSync(join(tmpdir(), "mailbox-repo-"));
  const run = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: repo, encoding: "utf8" }).trim();
  run("init", "-q", "-b", "main");
  run("remote", "add", "origin", "git@github.com:Acme/App.git");
  run("commit", "-q", "--allow-empty", "-m", "x");
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("TK_")));
  const cli = (env, ...args) => execFileSync("node", [SCRIPT, ...args], { cwd: repo, encoding: "utf8", env: { ...clean, ...env } });
  assert.equal(cli({}, "from"), `from: git@github.com:Acme/App.git | branch:main | cwd:${repo}\n`);
  assert.equal(cli({ TK_TEAM: "guild", TK_INSTANCE: "g1", TK_ROLE: "orchestrator", TK_LABEL: "Architect" }, "from"),
    `from: guild g1 | role:Architect | repo:git@github.com:Acme/App.git | branch:main | cwd:${repo}\n`);
  const { dir } = box("fleet f1 | role:Admiral | repo:git@github.com:Acme/App.git | branch:main | cwd:/w/app");
  const out = cli({ TEAM_ORDERS: dirname(dir) }, "inbox");
  assert.match(out, /\n  from: fleet f1 Admiral\n  need: do x\n/);
});
