// mailbox.mjs の resolve（指令に答える共通の書き手）と from（発行元の書き方・読み方）の契約テスト。
// 実行: pnpm test:order-mailbox （node:test。一時ディレクトリに受信箱と git リポジトリを作って確かめる。追加依存なし）
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, readlinkSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { actorOf, forkIdOf, fromLine, nameProblems, orderStatus, releaseOrder, requester, resolveOrder, routeOrder, routedMatches, sameActor, settleBox, takeOrder } from "./mailbox.mjs";

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

test("CLI: inbox の一覧は title:（日本語の短い題）があれば need の前に出す。本文の title: は拾わない", () => {
  const repo = mkdtempSync(join(tmpdir(), "mailbox-repo-"));
  const run = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: repo, encoding: "utf8" });
  run("init", "-q", "-b", "main");
  run("remote", "add", "origin", "git@github.com:Acme/App.git");
  run("commit", "-q", "--allow-empty", "-m", "x");
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("TK_")));
  const { dir, file } = box();
  writeFileSync(file, "# ORDER id:20260101-000000-x\nfrom: git@x:Acme/App.git | branch:main\nstatus: open\ntitle: 題を出す\nneed: do x\n");
  writeFileSync(join(dir, "20260101-000001-y.md"), "# ORDER id:20260101-000001-y\nfrom: git@x:Acme/App.git | branch:main\nstatus: open\nneed: do y\n\n## BODY\ntitle: not the title\n");
  const out = execFileSync("node", [SCRIPT, "inbox"], { cwd: repo, encoding: "utf8", env: { ...clean, TEAM_ORDERS: dirname(dir) } });
  assert.match(out, /\n  from: .*\n  title: 題を出す\n  need: do x\n/);
  assert.match(out, /000001-y\.md\n  from: .*\n  need: do y\n/);
});

// ---- 状態（open | routed | taken）と担当の守り ----
const ME = "git@x:Acme/App.git | branch:main";
const OTHER = "git@x:Acme/App.git | branch:feature/y";
const GUILD_ENV = { TK_TEAM: "guild", TK_INSTANCE: "g1", TK_LABEL: "Architect" };
const GUILD = actorOf(GUILD_ENV, {});
const head = (p, k) => (readFileSync(p, "utf8").split(/^## /m)[0].match(new RegExp(`^${k}: (.*)$`, "m")) || [])[1];

test("actorOf / sameActor: リポは origin + branch、チームは <team> <instance>（役職・cwd は比べない）", () => {
  assert.equal(actorOf({}, { origin: "git@x:Acme/App.git", repoId: "app", branch: "main" }), ME);
  assert.equal(GUILD, "guild g1 | role:Architect");
  assert.ok(sameActor(GUILD, "guild g1 | role:Worker"));
  assert.ok(sameActor(ME, `${ME} | cwd:/w/app`));
  assert.ok(!sameActor(ME, OTHER));
  assert.ok(routedMatches("guild:g1", GUILD, undefined, GUILD_ENV));
  assert.ok(routedMatches("council c1", "council c1 | role:Chair", undefined, { TK_TEAM: "council", TK_INSTANCE: "c1" }));
  assert.ok(!routedMatches("guild:g2", GUILD, undefined, GUILD_ENV));
  assert.ok(routedMatches("legate q1.2 plan-03", ME, "legate q1.2 plan-03"));
});

test("古い指令（status: なし・知らない値）は open。take → release で open に戻り、ログが残る", () => {
  const { file } = box();
  writeFileSync(file, "# ORDER id:20260101-000000-x\nfrom: git@x:Acme/App.git\ndate: 2026-01-01T00:00:00Z\nneed: do x\n");
  assert.equal(orderStatus(readFileSync(file, "utf8")), "open");
  takeOrder(file, { actor: ME, now: "T1" });
  assert.match(readFileSync(file, "utf8"), /\ndate: 2026-01-01T00:00:00Z\nstatus: taken\ntaken_by: git@x:Acme\/App\.git \| branch:main\ntaken_at: T1\nneed: do x\n/);
  releaseOrder(file, { actor: ME, now: "T2" });
  const text = readFileSync(file, "utf8");
  assert.equal(head(file, "status"), "open");
  assert.equal(head(file, "taken_by"), undefined);
  assert.match(text, /\n## STATUS_LOG\n- T1 open → taken \| by:git@x:Acme\/App\.git \| branch:main\n- T2 taken → open \| by:.*\n$/);
});

test("route: open → routed、振り直しも記録。routed は振り分け先だけが take でき、release で routed に戻る", () => {
  const { file } = box();
  routeOrder(file, { to: "guild:g2", by: "council c1 | role:Archon", now: "T1" });
  routeOrder(file, { to: "guild:g1", by: "council c1 | role:Archon", now: "T2" });
  assert.equal(head(file, "status"), "routed");
  assert.equal(head(file, "routed_to"), "guild:g1");
  assert.equal(head(file, "routed_at"), "T2");
  assert.throws(() => takeOrder(file, { actor: ME }), /振り分け先が別です: routed to guild:g1/);
  takeOrder(file, { actor: GUILD, env: GUILD_ENV, now: "T3" });
  assert.equal(head(file, "taken_by"), GUILD);
  assert.throws(() => routeOrder(file, { to: "guild:g3", by: ME }), /着手中です（taken by guild g1/);
  releaseOrder(file, { actor: "guild g1 | role:Worker" });
  assert.equal(head(file, "status"), "routed");
  assert.equal(head(file, "routed_to"), "guild:g1");
  const log = readFileSync(file, "utf8").split("## STATUS_LOG\n")[1].trim().split("\n");
  assert.deepEqual(log.map((l) => l.split(" | ")[0]), ["- T1 open → routed", "- T2 routed → routed", "- T3 routed → taken", log[3].split(" | ")[0]]);
  assert.match(log[3], /taken → routed/);
});

test("take / release の断り: 他人の taken、自分の二度目、取っていない者の release（--force は理由を残す）", () => {
  const { file } = box();
  takeOrder(file, { actor: ME });
  assert.throws(() => takeOrder(file, { actor: OTHER }), /他の担当が着手しています: taken by git@x:Acme\/App\.git \| branch:main/);
  assert.throws(() => takeOrder(file, { actor: ME }), /すでに自分が着手/);
  assert.throws(() => releaseOrder(file, { actor: OTHER }), /取ったのは別の担当です/);
  releaseOrder(file, { actor: OTHER, force: "session died", now: "T9" });
  assert.match(readFileSync(file, "utf8"), /- T9 taken → open \| by:.*feature\/y \| forced:session died \(was taken by git@x:Acme\/App\.git \| branch:main\)\n/);
  assert.throws(() => releaseOrder(file, { actor: ME }), /着手中ではありません（open）/);
});

test("resolve の守り: 他人の taken・別の振り分け先は断る。--force は RESOLUTION に forced: を残す。自分の taken は通る", () => {
  const a = box();
  takeOrder(a.file, { actor: ME });
  assert.throws(() => resolveOrder(a.file, { status: "done", body: BODY, by: BY, actor: OTHER }), /taken by .* です: 担当以外は答えません/);
  assert.equal(existsSync(a.file), true);
  const dest = resolveOrder(a.file, { status: "done", body: BODY, by: BY, actor: OTHER, force: "human asked" });
  assert.match(readFileSync(dest, "utf8"), /\nnotes: -\nforced: human asked \(was taken by git@x:Acme\/App\.git \| branch:main; resolved by .*feature\/y\)\n$/);
  assert.equal(head(dest, "status"), "done");
  const b = box();
  routeOrder(b.file, { to: "guild:g1", by: ME });
  assert.throws(() => resolveOrder(b.file, { status: "withdrawn", body: "notes: x\n", by: BY, actor: ME }), /routed to guild:g1 です/);
  resolveOrder(b.file, { status: "withdrawn", body: "notes: x\n", by: BY, actor: GUILD, env: GUILD_ENV });
  const c = box();
  takeOrder(c.file, { actor: ME });
  const text = readFileSync(resolveOrder(c.file, { status: "done", body: BODY, by: BY, actor: `${ME} | cwd:/w` }), "utf8");
  assert.match(text, /## STATUS_LOG\n- .* open → taken .*\n\n## RESOLUTION\n/);
  assert.doesNotMatch(text, /forced:/);
});

test("route / take / release は done/ の指令・答え済みの指令を断る", () => {
  const { file } = box();
  const dest = resolveOrder(file, { status: "withdrawn", body: "notes: x\n", by: BY });
  assert.throws(() => takeOrder(dest, { actor: ME }), /done\//);
  assert.throws(() => routeOrder(dest, { to: "guild:g1", by: ME }), /done\//);
  assert.throws(() => routeOrder(box().file, { by: ME }), /--to=/);
});

test("CLI: take / route と inbox の状態・担当・(you)", () => {
  const repo = mkdtempSync(join(tmpdir(), "mailbox-repo-"));
  const run = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: repo, encoding: "utf8" }).trim();
  run("init", "-q", "-b", "main");
  run("remote", "add", "origin", "git@github.com:Acme/App.git");
  run("commit", "-q", "--allow-empty", "-m", "x");
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("TK_")));
  const { dir, file } = box();
  const env = { ...clean, TEAM_ORDERS: dirname(dir) };
  const cli = (e, ...args) => execFileSync("node", [SCRIPT, ...args], { cwd: repo, encoding: "utf8", env: { ...env, ...e }, stdio: "pipe" });
  assert.equal(cli({}, "me"), "me: git@github.com:Acme/App.git | branch:main\n");
  assert.match(cli({}, "take", file), /^take: open → taken /);
  assert.match(cli({}, "inbox"), /\ntaken .*20260101-000000-x\.md\n  from: .*\n  need: do x\n  taken_by: git@github\.com:Acme\/App\.git \| branch:main \(you\)\n/);
  assert.match(cli(GUILD_ENV, "inbox"), /\n  taken_by: git@github\.com:Acme\/App\.git \| branch:main\n/);
  assert.throws(() => cli({}, "route", file, "--to=guild:g1"), /着手中です/);
  cli({}, "release", file);
  cli({}, "route", file, "--to=guild:g1");
  assert.match(cli(GUILD_ENV, "inbox"), /\nrouted .*\n[\s\S]*  routed_to: guild:g1 \(you\)\n/);
  assert.throws(() => cli({}, "take", file), (e) => /振り分け先が別です: routed to guild:g1/.test(e.stderr));
});

// リポの名前 = project.md の fork_id:（~/.team/_bin の tk_fork_id_of と同じ規則）。未宣言は移行中だけ旧い導き方
function checkout(forkId) {
  const top = mkdtempSync(join(tmpdir(), "mailbox-fid-"));
  if (forkId !== undefined) {
    mkdirSync(join(top, ".claude", "rules"), { recursive: true });
    writeFileSync(join(top, ".claude", "rules", "project.md"), `# project\nfork_id: ${forkId}\n`);
  }
  return top;
}

test("forkIdOf: 宣言があればそれ、未宣言（行なし・旧い -）は旧い名前、形の違い・strict の未宣言は throw", () => {
  const url = "git@github.com:Acme/Some-App.git";
  assert.deepEqual(forkIdOf(checkout("some-app"), url, {}), { id: "some-app", declared: true });
  assert.deepEqual(forkIdOf(checkout(), url, {}), { id: "acme--some-app", declared: false });
  assert.deepEqual(forkIdOf(checkout("-"), url, {}), { id: "acme--some-app", declared: false });
  assert.throws(() => forkIdOf(checkout("Some_App"), url, {}), /形が違います/);
  assert.throws(() => forkIdOf(checkout(), url, { TK_FORK_ID_STRICT: "1" }), /宣言されていません/);
  assert.deepEqual(forkIdOf(checkout("some-app"), url, { TK_FORK_ID_STRICT: "1" }), { id: "some-app", declared: true });
});

test("settleBox: 旧い箱を fork-id の名前へ移し、旧い名前は新しい箱へのリンクに（分裂のマージ・同名は上書きしない・どちらもない）", () => {
  const root = mkdtempSync(join(tmpdir(), "mailbox-settle-"));
  mkdirSync(join(root, "acme--app", "done"), { recursive: true });
  writeFileSync(join(root, "acme--app", "o1.md"), "o");
  writeFileSync(join(root, "acme--app", "done", "d1.md"), "d");
  settleBox("app", "acme--app", root);
  assert.equal(readFileSync(join(root, "app", "o1.md"), "utf8"), "o");
  assert.equal(readFileSync(join(root, "app", "done", "d1.md"), "utf8"), "d");
  assert.equal(readlinkSync(join(root, "acme--app")), "app");
  settleBox("app", "acme--app", root);
  assert.deepEqual(readdirSync(root).sort(), ["acme--app", "app"]);
  // 古い送り手が旧い箱を作り直した（分裂）→ 指令を移す。同名は上書きせず残る
  unlinkSync(join(root, "acme--app"));
  mkdirSync(join(root, "acme--app"));
  writeFileSync(join(root, "acme--app", "o2.md"), "n");
  settleBox("app", "acme--app", root);
  assert.equal(readFileSync(join(root, "app", "o2.md"), "utf8"), "n");
  assert.ok(lstatSync(join(root, "acme--app")).isSymbolicLink());
  unlinkSync(join(root, "acme--app"));
  mkdirSync(join(root, "acme--app"));
  writeFileSync(join(root, "acme--app", "o1.md"), "x");
  settleBox("app", "acme--app", root);
  assert.ok(lstatSync(join(root, "acme--app")).isDirectory());
  assert.equal(readFileSync(join(root, "app", "o1.md"), "utf8"), "o");
  // どちらもない → 新しい箱と旧い名前のリンク
  const r2 = mkdtempSync(join(tmpdir(), "mailbox-settle-"));
  settleBox("app", "acme--app", r2);
  assert.ok(existsSync(join(r2, "app")) && readlinkSync(join(r2, "acme--app")) === "app");
});

test("nameProblems: 形・fleet.conf の別のパス・手元の別のリポ・持ち主が別の既存の受信箱と重なれば不可", () => {
  const root = mkdtempSync(join(tmpdir(), "mailbox-names-"));
  const self = { top: "/w/app", repoId: "acme--app", oldId: "acme--app" };
  assert.deepEqual(nameProblems("app", self, [], [], root), []);
  assert.match(nameProblems("App_1", self, [], [], root)[0], /形が違います/);
  assert.match(nameProblems("shop", self, [], [{ name: "shop", path: "/w/shop" }], root)[0], /fleet.conf で \/w\/shop の名前/);
  assert.deepEqual(nameProblems("app", self, [], [{ name: "app", path: "/w/app" }], root), []);
  assert.match(nameProblems("shop", self, [{ top: "/w/shop", repoId: "shop" }], [], root)[0], /手元の別のリポ/);
  mkdirSync(join(root, "shop"));
  assert.match(nameProblems("shop", self, [], [], root)[0], /受信箱 .* がすでにあります/);
  // 自分の旧い名前のリンクが指す箱は自分のもの
  mkdirSync(join(root, "app"));
  symlinkSync("app", join(root, "acme--app"));
  assert.deepEqual(nameProblems("app", { ...self, repoId: "acme--app" }, [], [], root), []);
});
