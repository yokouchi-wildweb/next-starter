// mailbox.mjs の resolve（指令に答える共通の書き手）と from（発行元の書き方・読み方）の契約テスト。
// 実行: pnpm test .claude/skills/order/mailbox.test.mjs （node:test。一時ディレクトリに受信箱と git リポジトリを作って確かめる。追加依存なし）
// 本物の受け箱（~/.team/orders・~/.local/state/next-starter/orders）には決して触らない: HOME・XDG_STATE_HOME・ORDER_STATE_DIR を
// 一時の置き場に向けてから mailbox.mjs を読み込む（読み込み時に根を決めるため）。CLI の子プロセスもこの env を受け継ぐ
// （ORDER_ を除いた env でも HOME・XDG_STATE_HOME は一時のまま）
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { addItem, parseSheet, readSheet, renderSheet, setResult, shotsDirOf, startRun, summarize } from "./checkSheet.mjs";

const SANDBOX = mkdtempSync(join(tmpdir(), "mailbox-home-"));
process.env.HOME = join(SANDBOX, "home");
process.env.XDG_STATE_HOME = join(SANDBOX, "state");
process.env.ORDER_STATE_DIR = join(SANDBOX, "orders");
mkdirSync(process.env.HOME, { recursive: true });

const { actorOf, attachSheet, fileCheckOrder, fileOrder, forkIdOf, fromLine, kindOf, nameProblems, needBox, orderStatus, ordersRoot, releaseOrder, requester, resolveOrder, routeOrder, routedMatches, sameActor, slugOf, takeOrder } = await import("./mailbox.mjs");

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "mailbox.mjs");
const BY = { repoId: "acme-app", origin: "git@x:Acme/App.git", branch: "main", commit: "abc1234", pushed: "yes" };
const BODY = "implemented: did x\nconsume: -\npropagate: -\nnotice: -\nnotes: -\n";

function box(from = "git@x:Acme/App.git | branch:main") {
  const dir = join(mkdtempSync(join(tmpdir(), "mailbox-")), "acme-app");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "20260101-000000-x.md");
  writeFileSync(file, `# ORDER id:20260101-000000-x\nfrom: ${from}\nstatus: open\nneed: do x\n`);
  return { dir, file };
}

test("done: RESOLUTION を追記して done/ へ移す（/wen と呼び手の道具が読む形）", () => {
  const { dir, file } = box();
  const dest = resolveOrder(file, { status: "done", body: BODY, by: BY, now: "2026-01-01T00:00:00+09:00" });
  assert.equal(dest, join(dir, "done", "20260101-000000-x.md"));
  assert.equal(existsSync(file), false);
  const text = readFileSync(dest, "utf8");
  assert.match(text, /\nneed: do x\n\n## RESOLUTION\nresolved: 2026-01-01T00:00:00\+09:00   status: done\n/);
  assert.match(text, /\nby: acme-app \| git@x:Acme\/App\.git \| branch:main \| commit:abc1234 \| pushed:yes\nimplemented: did x\n/);
  assert.match(text, /\nnotes: -\n$/);
  assert.match(text, /^# ORDER id:20260101-000000-x\nfrom: .*\nstatus: done\nneed: do x\n/);
});

test("先頭の status: は RESOLUTION の status に揃う（partial / relayed / rejected / withdrawn も）", () => {
  const head = (p) => readFileSync(p, "utf8").match(/^status: (\S+)$/m)[1];
  const p = box();
  assert.equal(head(resolveOrder(p.file, { status: "partial", body: BODY, by: BY })), "partial");
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

test("done: 書く行が欠けていても断らず、書かれた行をそのまま書く（D437）", () => {
  const { file } = box();
  const dest = resolveOrder(file, { status: "done", body: "implemented: x\n", by: BY });
  assert.match(readFileSync(dest, "utf8"), /\n## RESOLUTION\nresolved: .*status: done\nby: .*\nimplemented: x\n/);
});

test("発行元が何であっても要る行は status ごとの同じ組（依頼元の欄は依頼元が確かめる）", () => {
  const { file } = box("someone s1 | role:Lead | repo:git@x:Acme/App.git");
  const dest = resolveOrder(file, { status: "done", body: BODY, by: BY });
  assert.match(readFileSync(dest, "utf8"), /status: done\n/);
});

test("done の --pushed が無ければ pushed:-", () => {
  const { file } = box();
  const dest = resolveOrder(file, { status: "done", body: BODY, by: { ...BY, pushed: undefined } });
  assert.match(readFileSync(dest, "utf8"), /\| pushed:-\n/);
});

test("relayed / rejected / withdrawn: 短い by 行と、それぞれの要る行", () => {
  const a = box();
  const dest = resolveOrder(a.file, { status: "relayed", body: "relayed_to: other--repo/1.md\nnotes: theirs\n", by: BY });
  assert.match(readFileSync(dest, "utf8"), /status: relayed\nby: acme-app \| commit:- \| pushed:-\nrelayed_to: other--repo\/1\.md\n/);
  const b = box();
  resolveOrder(b.file, { status: "withdrawn", body: "notes: no longer needed\n", by: BY });
});

test("知らない status は断る。done/ の指令・二度目の RESOLUTION は注意の 1 行で書き足す(done/ のまま)", (t) => {
  const said = [];
  t.mock.method(console, "error", (line) => said.push(line));
  const { file } = box();
  assert.throws(() => resolveOrder(file, { status: "ok", body: BODY, by: BY }), /--status/);
  const dest = resolveOrder(file, { status: "withdrawn", body: "notes: x\n", by: BY });
  assert.equal(resolveOrder(dest, { status: "done", body: "notes: y\n", by: BY }), dest);
  const text = readFileSync(dest, "utf8");
  assert.equal(text.match(/^## RESOLUTION$/gm).length, 2);
  assert.match(text, /^status: done$/m);
  assert.ok(!existsSync(join(dirname(dest), "done", "20260101-000000-x.md")));
  assert.ok(said.some((l) => /注意: done\/ の指令です/.test(l)) && said.some((l) => /注意: すでに RESOLUTION があります/.test(l)));
});

test("CLI: by の repo-id・branch・commit は実行したリポから取る", () => {
  const repo = mkdtempSync(join(tmpdir(), "mailbox-repo-"));
  writeFileSync(join(repo, "repo.json"), '{"repo_id": "acme-app", "tier": "leaf"}\n');
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
  assert.match(text, new RegExp(`\\nby: acme-app \\| git@github\\.com:Acme/App\\.git \\| branch:main \\| commit:${sha} \\| pushed:no \\(no remote\\)\\n`));
});

test("CLI: repos は本体が同じ親フォルダにある linked worktree を数えない(別の repo.json を持つ鉄道の作業場で url を取り違えない)", () => {
  const parent = mkdtempSync(join(tmpdir(), "mailbox-repos-"));
  const mk = (name, origin, id) => {
    const dir = join(parent, name);
    mkdirSync(dir);
    const run = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: dir, encoding: "utf8" }).trim();
    run("init", "-q", "-b", "main");
    run("remote", "add", "origin", origin);
    writeFileSync(join(dir, "repo.json"), `{\n  "repo_id": "${id}",\n  "tier": "leaf"\n}\n`);
    run("add", "-A");
    run("commit", "-q", "-m", "x");
    return { dir, run };
  };
  const self = mk("self", "git@github.com:Acme/self.git", "self-repo");
  const other = mk("other", "git@github.com:Acme/other.git", "other-repo");
  // other の作業場: その木は self の repo.json を持つ(鉄道の track が上流の repo.json を持つ形)
  other.run("worktree", "add", "-q", "-b", "track", join(parent, "other.wt-track"));
  writeFileSync(join(parent, "other.wt-track", "repo.json"), `{\n  "repo_id": "self-repo",\n  "tier": "leaf"\n}\n`);
  const out = execFileSync("node", [SCRIPT, "repos"], { cwd: self.dir, encoding: "utf8" });
  assert.match(out, /repo: self-repo \(self\)\n {2}url: git@github\.com:Acme\/self\.git\n {2}path: [^\n]*\/self\n/);
  assert.match(out, /repo: other-repo\n {2}url: git@github\.com:Acme\/other\.git\n {2}path: [^\n]*\/other\n/);
  assert.equal(out.includes("other.wt-track"), false);
});

test("from: ORDER_ACTOR があれば発行元 = その名前、リポは repo: に残す", () => {
  const where = { origin: "git@x:Acme/App.git", repoId: "acme-app", branch: "main", cwd: "/w/app" };
  assert.equal(fromLine({}, where), "git@x:Acme/App.git | branch:main | cwd:/w/app");
  assert.equal(fromLine({}, { ...where, origin: "" }), "acme-app | branch:main | cwd:/w/app");
  assert.equal(fromLine({ ORDER_ACTOR: "lead l1 | role:Lead" }, where), "lead l1 | role:Lead | repo:git@x:Acme/App.git | branch:main | cwd:/w/app");
  assert.equal(fromLine({ ORDER_ACTOR: "  " }, where), "git@x:Acme/App.git | branch:main | cwd:/w/app");
  // 古いチームの印（TK_*）は読まない
  assert.equal(fromLine({ TK_TEAM: "x", TK_INSTANCE: "y" }, where), "git@x:Acme/App.git | branch:main | cwd:/w/app");
});

test("requester: 先頭が発行元。名前（repo: 欄あり）/ repo を見分ける", () => {
  assert.deepEqual(requester("git@x:Acme/App.git | branch:main | cwd:/w/app"), { kind: "repo", label: "git@x:Acme/App.git", repo: "git@x:Acme/App.git" });
  assert.deepEqual(requester("lead l1 | role:Lead | repo:git@x:Acme/App.git | branch:main | cwd:/w/app"), { kind: "actor", label: "lead l1 Lead", repo: "git@x:Acme/App.git" });
  assert.deepEqual(requester("tool t1 | repo:git@x:Acme/App.git"), { kind: "actor", label: "tool t1", repo: "git@x:Acme/App.git" });
  // --from で手書きした名前（role: 欄だけ、repo: 欄なし）も名前。リポは分からない
  assert.deepEqual(requester("lead c1 | role:Lead"), { kind: "actor", label: "lead c1 Lead", repo: null });
});

test("CLI: from は ORDER_ACTOR を読み、inbox の一覧は発行元の名前を出す", () => {
  const repo = mkdtempSync(join(tmpdir(), "mailbox-repo-"));
  writeFileSync(join(repo, "repo.json"), '{"repo_id": "acme-app", "tier": "leaf"}\n');
  const run = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: repo, encoding: "utf8" }).trim();
  run("init", "-q", "-b", "main");
  run("remote", "add", "origin", "git@github.com:Acme/App.git");
  run("commit", "-q", "--allow-empty", "-m", "x");
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("ORDER_")));
  const cli = (env, ...args) => execFileSync("node", [SCRIPT, ...args], { cwd: repo, encoding: "utf8", env: { ...clean, ...env } });
  assert.equal(cli({}, "from"), `from: git@github.com:Acme/App.git | branch:main | cwd:${repo}\n`);
  assert.equal(cli({ ORDER_ACTOR: "lead l1 | role:Lead" }, "from"),
    `from: lead l1 | role:Lead | repo:git@github.com:Acme/App.git | branch:main | cwd:${repo}\n`);
  const { dir } = box("lead f1 | role:Lead | repo:git@github.com:Acme/App.git | branch:main | cwd:/w/app");
  const out = cli({ ORDER_STATE_DIR: dirname(dir) }, "inbox");
  assert.match(out, /\n  from: lead f1 Lead\n  need: do x\n/);
});

test("CLI: inbox の一覧は title:（日本語の短い題）があれば need の前に出す。本文の title: は拾わない", () => {
  const repo = mkdtempSync(join(tmpdir(), "mailbox-repo-"));
  writeFileSync(join(repo, "repo.json"), '{"repo_id": "acme-app", "tier": "leaf"}\n');
  const run = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: repo, encoding: "utf8" });
  run("init", "-q", "-b", "main");
  run("remote", "add", "origin", "git@github.com:Acme/App.git");
  run("commit", "-q", "--allow-empty", "-m", "x");
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("ORDER_")));
  const { dir, file } = box();
  writeFileSync(file, "# ORDER id:20260101-000000-x\nfrom: git@x:Acme/App.git | branch:main\nstatus: open\ntitle: 題を出す\nneed: do x\n");
  writeFileSync(join(dir, "20260101-000001-y.md"), "# ORDER id:20260101-000001-y\nfrom: git@x:Acme/App.git | branch:main\nstatus: open\nneed: do y\n\n## BODY\ntitle: not the title\n");
  const out = execFileSync("node", [SCRIPT, "inbox"], { cwd: repo, encoding: "utf8", env: { ...clean, ORDER_STATE_DIR: dirname(dir) } });
  assert.match(out, /\n  from: .*\n  title: 題を出す\n  need: do x\n/);
  assert.match(out, /000001-y\.md\n  from: .*\n  need: do y\n/);
});

test("kind: 先頭の kind: の値だけを読む（題・本文の kind: は読まない、値の意味は問わない）", () => {
  assert.equal(kindOf("# ORDER id:a\nfrom: x\nstatus: open\nkind: any-value\nneed: y\n"), "any-value");
  assert.equal(kindOf("# ORDER id:a\nfrom: x\nstatus: open\ntitle: 【★印】題\nneed: y\n"), "");
  assert.equal(kindOf("# ORDER id:a\nfrom: x\nneed: y\n\n## BODY\nkind: other\n"), "");
});

test("CLI: inbox は kind: の行を出し、--kind=<値> でその値だけに絞る", () => {
  const repo = mkdtempSync(join(tmpdir(), "mailbox-repo-"));
  writeFileSync(join(repo, "repo.json"), '{"repo_id": "acme-app", "tier": "leaf"}\n');
  const run = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: repo, encoding: "utf8" });
  run("init", "-q", "-b", "main");
  run("remote", "add", "origin", "git@github.com:Acme/App.git");
  run("commit", "-q", "--allow-empty", "-m", "x");
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("ORDER_")));
  const { dir, file } = box();
  writeFileSync(file, "# ORDER id:20260101-000000-x\nfrom: lead c1 | role:Lead\nstatus: open\nkind: special\ntitle: 題\nneed: do x\n");
  writeFileSync(join(dir, "20260101-000001-y.md"), "# ORDER id:20260101-000001-y\nfrom: git@x:Acme/App.git | branch:main\nstatus: open\nneed: do y\n");
  const env = { ...clean, ORDER_STATE_DIR: dirname(dir) };
  const all = execFileSync("node", [SCRIPT, "inbox"], { cwd: repo, encoding: "utf8", env });
  assert.match(all, /000000-x\.md\n  from: lead c1 Lead\n  kind: special\n  title: 題\n  need: do x\n/);
  assert.match(all, /000001-y\.md\n  from: .*\n  need: do y\n/);
  const only = execFileSync("node", [SCRIPT, "inbox", "--kind=special"], { cwd: repo, encoding: "utf8", env });
  assert.match(only, /000000-x\.md/);
  assert.doesNotMatch(only, /000001-y\.md/);
});

test("CLI: resolve の後の口 ORDER_RESOLVED_HOOK は答えた指令のパスで呼ばれ、落ちても答えは残る。無ければ何もしない", () => {
  const repo = mkdtempSync(join(tmpdir(), "mailbox-repo-"));
  writeFileSync(join(repo, "repo.json"), '{"repo_id": "acme-app", "tier": "leaf"}\n');
  const run = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: repo, encoding: "utf8" });
  run("init", "-q", "-b", "main");
  run("commit", "-q", "--allow-empty", "-m", "x");
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("ORDER_")));
  const bodyFile = join(repo, "..", `body-hook-${process.pid}.md`);
  writeFileSync(bodyFile, BODY);
  const log = join(repo, "..", `hook-${process.pid}.log`);
  const hook = join(repo, "..", `hook-${process.pid}.sh`);
  writeFileSync(hook, `#!/bin/sh\necho "$1" >> "${log}"\n`, { mode: 0o755 });
  const a = box();
  execFileSync("node", [SCRIPT, "resolve", a.file, "--status=done", `--body=${bodyFile}`, "--pushed=-"], { cwd: repo, encoding: "utf8", env: { ...clean, ORDER_RESOLVED_HOOK: hook } });
  assert.equal(readFileSync(log, "utf8"), `${join(dirname(a.file), "done", "20260101-000000-x.md")}\n`);
  const b = box();
  const failing = join(repo, "..", `hook-fail-${process.pid}.sh`);
  writeFileSync(failing, "#!/bin/sh\nexit 3\n", { mode: 0o755 });
  execFileSync("node", [SCRIPT, "resolve", b.file, "--status=done", `--body=${bodyFile}`, "--pushed=-"], { cwd: repo, stdio: "pipe", env: { ...clean, ORDER_RESOLVED_HOOK: failing } });
  assert.equal(existsSync(join(dirname(b.file), "done", "20260101-000000-x.md")), true);
  const c = box();
  execFileSync("node", [SCRIPT, "resolve", c.file, "--status=done", `--body=${bodyFile}`, "--pushed=-"], { cwd: repo, stdio: "pipe", env: clean });
  assert.equal(readFileSync(log, "utf8").split("\n").filter(Boolean).length, 1);
});

// ---- 状態（open | routed | taken）と担当の守り ----
const ME = "git@x:Acme/App.git | branch:main";
const OTHER = "git@x:Acme/App.git | branch:feature/y";
const GUILD_ENV = { ORDER_ACTOR: "guild g1 | role:Architect" };
const GUILD = actorOf(GUILD_ENV, {});
const head = (p, k) => (readFileSync(p, "utf8").split(/^## /m)[0].match(new RegExp(`^${k}: (.*)$`, "m")) || [])[1];

test("actorOf / sameActor: リポは origin + branch、ORDER_ACTOR の名前は role: の前だけ（役・cwd は比べない）", () => {
  assert.equal(actorOf({}, { origin: "git@x:Acme/App.git", repoId: "app", branch: "main" }), ME);
  assert.equal(GUILD, "guild g1 | role:Architect");
  assert.ok(sameActor(GUILD, "guild g1 | role:Worker"));
  assert.ok(sameActor(ME, `${ME} | cwd:/w/app`));
  assert.ok(!sameActor(ME, OTHER));
  assert.ok(routedMatches("guild g1", GUILD, undefined, GUILD_ENV));
  assert.ok(!routedMatches("guild:g1", GUILD, undefined, GUILD_ENV));   // 振り先は中を読まない: 読み替えはしない
  assert.ok(!routedMatches("guild g2", GUILD, undefined, GUILD_ENV));
  assert.ok(routedMatches("build q1.2 plan-03", ME, "build q1.2 plan-03"));
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
  routeOrder(file, { to: "guild g2", by: "boss b1 | role:Lead", now: "T1" });
  routeOrder(file, { to: "guild g1", by: "boss b1 | role:Lead", now: "T2" });
  assert.equal(head(file, "status"), "routed");
  assert.equal(head(file, "routed_to"), "guild g1");
  assert.equal(head(file, "routed_at"), "T2");
  assert.throws(() => takeOrder(file, { actor: ME }), /振り分け先が別です: routed to guild g1/);
  takeOrder(file, { actor: GUILD, env: GUILD_ENV, now: "T3" });
  assert.equal(head(file, "taken_by"), GUILD);
  assert.throws(() => routeOrder(file, { to: "guild g3", by: ME }), /着手中です（taken by guild g1.*--force=<理由>/);
  releaseOrder(file, { actor: "guild g1 | role:Worker" });
  assert.equal(head(file, "status"), "routed");
  assert.equal(head(file, "routed_to"), "guild g1");
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
  routeOrder(b.file, { to: "guild g1", by: ME });
  assert.throws(() => resolveOrder(b.file, { status: "withdrawn", body: "notes: x\n", by: BY, actor: ME }), /routed to guild g1 です/);
  resolveOrder(b.file, { status: "withdrawn", body: "notes: x\n", by: BY, actor: GUILD, env: GUILD_ENV });
  const c = box();
  takeOrder(c.file, { actor: ME });
  const text = readFileSync(resolveOrder(c.file, { status: "done", body: BODY, by: BY, actor: `${ME} | cwd:/w` }), "utf8");
  assert.match(text, /## STATUS_LOG\n- .* open → taken .*\n\n## RESOLUTION\n/);
  assert.doesNotMatch(text, /forced:/);
});

test("route --force: 着手中の指令を理由つきで振り直す(取った者を外し、ログに forced: と前の持ち主)。done/ の指令は注意の 1 行で続ける", (t) => {
  const said = [];
  t.mock.method(console, "error", (line) => said.push(line));
  const { file } = box();
  takeOrder(file, { actor: GUILD, env: GUILD_ENV, now: "T1" });
  routeOrder(file, { to: "lead qa", by: ME, force: "g1 stopped", now: "T2" });
  assert.equal(head(file, "status"), "routed");
  assert.equal(head(file, "routed_to"), "lead qa");
  assert.equal(head(file, "taken_by"), undefined);
  assert.match(readFileSync(file, "utf8"), /- T2 taken → routed \| to:lead qa \| by:.* \| forced:g1 stopped \(was taken by guild g1 \| role:Architect\)\n$/);
  const dest = resolveOrder(box().file, { status: "withdrawn", body: "notes: x\n", by: BY });
  takeOrder(dest, { actor: ME });
  assert.equal(head(dest, "status"), "taken");
  assert.ok(said.some((l) => /注意: done\/ の指令です/.test(l)));
  assert.throws(() => routeOrder(box().file, { by: ME }), /--to=/);
});

test("CLI: take / route と inbox の状態・担当・(you)", () => {
  const repo = mkdtempSync(join(tmpdir(), "mailbox-repo-"));
  writeFileSync(join(repo, "repo.json"), '{"repo_id": "acme-app", "tier": "leaf"}\n');
  const run = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: repo, encoding: "utf8" }).trim();
  run("init", "-q", "-b", "main");
  run("remote", "add", "origin", "git@github.com:Acme/App.git");
  run("commit", "-q", "--allow-empty", "-m", "x");
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("ORDER_")));
  const { dir, file } = box();
  const env = { ...clean, ORDER_STATE_DIR: dirname(dir) };
  const cli = (e, ...args) => execFileSync("node", [SCRIPT, ...args], { cwd: repo, encoding: "utf8", env: { ...env, ...e }, stdio: "pipe" });
  assert.equal(cli({}, "me"), "me: git@github.com:Acme/App.git | branch:main\n");
  assert.match(cli({}, "take", file), /^take: open → taken /);
  assert.match(cli({}, "inbox"), /\ntaken .*20260101-000000-x\.md\n  from: .*\n  need: do x\n  taken_by: git@github\.com:Acme\/App\.git \| branch:main \(you\)\n/);
  assert.match(cli(GUILD_ENV, "inbox"), /\n  taken_by: git@github\.com:Acme\/App\.git \| branch:main\n/);
  assert.throws(() => cli({}, "route", file, "--to=guild g1"), /着手中です/);
  cli({}, "release", file);
  cli({}, "route", file, "--to=guild g1");
  assert.match(cli(GUILD_ENV, "inbox"), /\nrouted .*\n[\s\S]*  routed_to: guild g1 \(you\)\n/);
  assert.throws(() => cli({}, "take", file), (e) => /振り分け先が別です: routed to guild g1/.test(e.stderr));
  assert.match(cli({}, "route", file, "--to=lead qa", "--force=gone"), /^route: routed → routed /);
});

// リポの名前 = repo.json の repo_id（~/.team/_bin の tk_fork_id_of と同じ規則）。読めなければ id: null と理由
function checkout(forkId) {
  const top = mkdtempSync(join(tmpdir(), "mailbox-fid-"));
  if (forkId !== undefined) {
    mkdirSync(join(top, ".claude", "rules"), { recursive: true });
    writeFileSync(join(top, "repo.json"), `{"repo_id": "${forkId}", "tier": "leaf"}\n`);
  }
  return top;
}

test("forkIdOf: 宣言があればそれ、無い・形の違い・旧い - は id: null と理由(throw しない)。needBox は名前が要る所で宣言の仕方を 1 行", () => {
  assert.deepEqual(forkIdOf(checkout("some-app")), { id: "some-app", error: null });
  for (const top of [checkout(), checkout("-"), checkout("Some_App")]) {
    const r = forkIdOf(top);
    assert.equal(r.id, null);
    assert.match(r.error, /repo\.json$/);
  }
  assert.throws(() => needBox({ repoId: null, idError: "x" }), /repo_id が読めません（x）。pnpm workflow repo-json set repo_id <名前> で宣言する/);
  assert.equal(needBox({ repoId: "app" }), "app");
});

test("CLI: repo_id が読めないリポでは、自分の箱が要る命令(self・inbox)だけが 1 行で止まり、me・from は動く", () => {
  const repo = mkdtempSync(join(tmpdir(), "mailbox-undeclared-"));
  const run = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: repo, encoding: "utf8" }).trim();
  run("init", "-q", "-b", "main");
  run("remote", "add", "origin", "git@github.com:Acme/App.git");
  run("commit", "-q", "--allow-empty", "-m", "x");
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("ORDER_")));
  const env = { ...clean, ORDER_STATE_DIR: mkdtempSync(join(tmpdir(), "mailbox-undeclared-root-")) };
  const cli = (...args) => execFileSync("node", [SCRIPT, ...args], { cwd: repo, encoding: "utf8", env, stdio: "pipe" });
  assert.match(cli("me"), /^me: git@github\.com:Acme\/App\.git \| branch:main\n$/);
  for (const cmd of ["self", "inbox"]) assert.throws(() => cli(cmd), (e) => /repo_id が読めません/.test(e.stderr));
});

test("ordersRoot: 根の並び ORDER_STATE_DIR → $XDG_STATE_HOME/next-starter/orders → ~/.local/state/next-starter/orders", () => {
  const t = mkdtempSync(join(tmpdir(), "mailbox-root-"));
  assert.deepEqual(ordersRoot({ ORDER_STATE_DIR: join(t, "x"), HOME: join(t, "h") }), { root: join(t, "x"), explicit: true });
  assert.deepEqual(ordersRoot({ XDG_STATE_HOME: join(t, "s"), HOME: join(t, "h") }), { root: join(t, "s", "next-starter", "orders"), explicit: false });
  assert.deepEqual(ordersRoot({ HOME: join(t, "h") }), { root: join(t, "h", ".local", "state", "next-starter", "orders"), explicit: false });
});

test("nameProblems: 形・リポの一覧の別のパス・手元の別のリポ・持ち主が別の既存の受信箱と重なれば不可", () => {
  const root = mkdtempSync(join(tmpdir(), "mailbox-names-"));
  const self = { top: "/w/app", repoId: "acme-app" };
  assert.deepEqual(nameProblems("app", self, [], [], root), []);
  assert.match(nameProblems("App_1", self, [], [], root)[0], /形が違います/);
  assert.match(nameProblems("shop", self, [], [{ name: "shop", path: "/w/shop" }], root)[0], /リポの一覧で \/w\/shop の名前/);
  assert.deepEqual(nameProblems("app", self, [], [{ name: "app", path: "/w/app" }], root), []);
  assert.match(nameProblems("shop", self, [{ top: "/w/shop", repoId: "shop" }], [], root)[0], /手元の別のリポ/);
  mkdirSync(join(root, "shop"));
  assert.match(nameProblems("shop", self, [], [], root)[0], /受信箱 .* がすでにあります/);
  // 自分の名前の箱は自分のもの
  mkdirSync(join(root, "app"));
  assert.deepEqual(nameProblems("app", { ...self, repoId: "app" }, [], [], root), []);
});

// ---- ブラウザ確認のシート（checkSheet.mjs と mailbox.mjs check）----
const ITEM = { page: "/admin/coupons", as: "admin", steps: ["一覧を開く", "保存"], expect: "行が増える" };

test("シート: add は無ければ作り、同じ page・as・expect は 1 項目にまとめて source: を足す。形の違いは断る", () => {
  const path = join(mkdtempSync(join(tmpdir(), "sheet-")), "acc.md");
  assert.deepEqual(addItem(path, { ...ITEM, source: "fleet:f1 segment:s3" }, { now: "T1", title: "題" }), { id: "C1", merged: false });
  assert.deepEqual(addItem(path, { ...ITEM, steps: ["別"], source: "fleet:f1 segment:s4" }, { now: "T2" }), { id: "C1", merged: true });
  assert.deepEqual(addItem(path, { ...ITEM, as: "guest" }, { now: "T3" }), { id: "C2", merged: false });
  const sheet = readSheet(path);
  assert.equal(sheet.head.title, "題");
  assert.deepEqual(sheet.items[0].source, ["fleet:f1 segment:s3", "fleet:f1 segment:s4"]);
  assert.deepEqual(sheet.items[0].steps, ["一覧を開く", "保存"]);
  assert.equal(sheet.items[0].widths, "375,1280");
  assert.equal(parseSheet(renderSheet(sheet)).items.length, 2);
  assert.throws(() => addItem(path, { page: "x", as: "Root!", steps: [], expect: "" }, { now: "T4" }), /--page=.*--as=.*--step=.*--expect=/);
  assert.equal(addItem(path, { ...ITEM, as: "store_staff" }, { now: "T5" }).merged, false, "fork が足した役割の名前も書ける");
});

test("シート: run で runs が増え、result は ok / ng / skip（ng・skip は evidence が要る）", () => {
  const path = join(mkdtempSync(join(tmpdir(), "sheet-")), "acc.md");
  addItem(path, ITEM, { now: "T1" });
  addItem(path, { ...ITEM, page: "/" }, { now: "T1" });
  assert.equal(startRun(path, { now: "T2" }), 1);
  assert.throws(() => setResult(path, "C1", { result: "ng", now: "T3" }), /evidence/);
  assert.throws(() => setResult(path, "C9", { result: "ok", now: "T3" }), /項目がありません/);
  setResult(path, "C1", { result: "ng", evidence: "行が増えない", now: "T3" });
  setResult(path, "C2", { result: "ok", now: "T3" });
  const sheet = readSheet(path);
  assert.equal(sheet.head.lastRun, "T2");
  assert.equal(sheet.items[0].ran_at, "T3");
  assert.deepEqual(summarize(sheet), { total: 2, ok: 1, ng: 1, skip: 0, pending: 0 });
});

test("指令とシート: file は kind: browser-check の指令とシートを並べて書き、一覧はシートを指令に数えず数を出す。resolve でシートと置き場も done/ へ", () => {
  const { dir } = box();
  const src = join(dirname(dir), "acc.md");
  addItem(src, { ...ITEM, source: "fleet:f1 segment:s3" }, { now: "T1" });
  const r = fileCheckOrder({ box: dir, to: "git@x:Acme/App.git | box:acme-app", from: "fleet f1 | role:Admiral", src, title: "確認", now: new Date(2026, 0, 2, 3, 4, 5) });
  assert.equal(r.order, join(dir, "20260102-030405-browser-check.md"));
  assert.equal(r.sheet, join(dir, "20260102-030405-browser-check.check.md"));
  const text = readFileSync(r.order, "utf8");
  assert.match(text, /\nstatus: open\nkind: browser-check\ncheck_sheet: 20260102-030405-browser-check\.check\.md\ntitle: 確認\n/);
  assert.match(readFileSync(r.sheet, "utf8"), /^# CHECK SHEET order:20260102-030405-browser-check {2}repo:acme-app\n/);
  assert.equal(existsSync(src), true);
  const again = fileCheckOrder({ box: dir, to: "-", from: "-", src, title: "確認", now: new Date(2026, 0, 2, 3, 4, 5) });
  assert.equal(again.order, join(dir, "20260102-030405-browser-check-2.md"));
  mkdirSync(shotsDirOf(r.sheet));
  writeFileSync(join(shotsDirOf(r.sheet), "C1-375.png"), "");
  const dest = resolveOrder(r.order, { status: "partial", body: BODY, by: BY });
  assert.equal(existsSync(join(dir, "done", "20260102-030405-browser-check.check.md")), true);
  assert.equal(existsSync(join(dir, "done", "20260102-030405-browser-check.check", "C1-375.png")), true);
  assert.equal(existsSync(r.sheet), false);
  assert.match(dest, /done/);
});

test("fileOrder: /order の形で 1 件書く（省いた欄は -、kind / tried は指定した時だけ、本文は先頭の後）。同じ秒は -2、箱が無ければ作る", () => {
  const dir = join(mkdtempSync(join(tmpdir(), "mailbox-")), "acme-app");
  const now = new Date(2026, 0, 2, 3, 4, 5);
  const p = fileOrder({ box: dir, to: "git@x:Acme/App.git | box:acme-app", from: "git@x:Me.git | branch:main | cwd:/w", title: "題", need: "Fix the login\nbutton", kind: "special", constraints: "unchanged: x", tried: "t", body: "\n## DETAIL\nmore", now });
  assert.equal(p, join(dir, "20260102-030405-fix-the-login-button.md"));
  const text = readFileSync(p, "utf8");
  assert.match(text, /^# ORDER id:20260102-030405-fix-the-login-button\nfrom: git@x:Me\.git \| branch:main \| cwd:\/w\nto: git@x:Acme\/App\.git \| box:acme-app\ndate: 2026-01-02T03:04:05[+-]\d\d:\d\d\nstatus: open\nkind: special\ntitle: 題\nneed: Fix the login button\nwhy: -\ndone_when: -\nconstraints: unchanged: x\nrefs: -\nnotes: -\ntried: t\n\n## DETAIL\nmore\n$/);
  assert.equal(orderStatus(text), "open");
  assert.equal(kindOf(text), "special");
  const again = fileOrder({ box: dir, to: "-", from: "-", title: "題", need: "Fix the login button", now });
  assert.equal(again, join(dir, "20260102-030405-fix-the-login-button-2.md"));
  assert.doesNotMatch(readFileSync(again, "utf8"), /\nkind:|\ntried:/);
  assert.deepEqual(readdirSync(dir).filter((f) => !f.endsWith(".md")), []);
  assert.throws(() => fileOrder({ box: dir, to: "-", from: "-", title: "題", need: "x", kind: "Bad Kind" }), /--kind/);
  assert.throws(() => fileOrder({ box: dir, to: "-", from: "-", need: "x" }), /--title/);
  assert.throws(() => fileOrder({ box: dir, to: "-", from: "-", title: "題" }), /--need/);
  assert.throws(() => fileOrder({ box: dir, to: "-", from: "-", title: "題", need: "x", slug: "../x" }), /--slug/);
  assert.equal(slugOf("ログインを直す"), "order");
});

test("CLI: file は self / checkout のパスの受信箱に書いてパスだけを出す。from は from の値、--from で上書き、--body の本文を後に付ける", () => {
  const repo = mkdtempSync(join(tmpdir(), "mailbox-repo-"));
  writeFileSync(join(repo, "repo.json"), '{"repo_id": "acme-app", "tier": "leaf"}\n');
  const run = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: repo, encoding: "utf8" }).trim();
  run("init", "-q", "-b", "main");
  run("remote", "add", "origin", "git@github.com:Acme/App.git");
  writeFileSync(join(repo, "repo.json"), JSON.stringify({ repo_id: "acme-app", tier: "leaf" }));
  run("add", "repo.json");
  run("commit", "-q", "-m", "x");
  const root = mkdtempSync(join(tmpdir(), "mailbox-root-"));
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("ORDER_")));
  const cli = (...args) => execFileSync("node", [SCRIPT, ...args], { cwd: repo, encoding: "utf8", env: { ...clean, ORDER_STATE_DIR: root } });
  const bodyFile = join(root, "body.txt");
  writeFileSync(bodyFile, "## DETAIL\nx\n");
  const out = cli("file", "--to=self", "--title=題", "--need=do the thing", "--slug=do-it", `--body=${bodyFile}`).trim();
  assert.match(out, new RegExp(`^${join(root, "acme-app")}/\\d{8}-\\d{6}-do-it\\.md$`));
  const text = readFileSync(out, "utf8");
  assert.match(text, new RegExp(`\nfrom: git@github\\.com:Acme/App\\.git \\| branch:main \\| cwd:${repo}\nto: git@github\\.com:Acme/App\\.git \\| box:acme-app\n`));
  assert.match(text, /\nnotes: -\n\n## DETAIL\nx\n$/);
  const out2 = cli("file", `--to=${repo}`, "--title=題", "--need=other", "--kind=special", "--from=lead c1 | role:Lead").trim();
  assert.match(readFileSync(out2, "utf8"), /\nfrom: lead c1 \| role:Lead\n[\s\S]*\nkind: special\n/);
  assert.throws(() => execFileSync("node", [SCRIPT, "file", "--to=self", "--title=題"], { cwd: repo, encoding: "utf8", stdio: "pipe", env: { ...clean, ORDER_STATE_DIR: root } }), /usage/);
});

test("指令とシート: attach --only は ng の項目だけを C1.. に写し、結果を消して was: に前の結果を残す。題は指令の題", () => {
  const { dir, file } = box();
  writeFileSync(file, "# ORDER id:20260101-000000-x\nfrom: x\nstatus: open\ntitle: 直す\nneed: fix\n");
  const src = join(dirname(dir), "done.check.md");
  addItem(src, ITEM, { now: "T1", title: "元" });
  addItem(src, { ...ITEM, page: "/" }, { now: "T1" });
  setResult(src, "C2", { result: "ng", evidence: "白い画面", now: "T2" });
  const sheet = attachSheet(file, { src, only: ["C2"], now: "T3" });
  assert.equal(sheet, join(dir, "20260101-000000-x.check.md"));
  assert.match(readFileSync(file, "utf8"), /\nstatus: open\ncheck_sheet: 20260101-000000-x\.check\.md\ntitle: 直す\n/);
  const s = readSheet(sheet);
  assert.equal(s.head.title, "直す");
  assert.equal(s.items.length, 1);
  assert.equal(s.items[0].id, "C1");
  assert.equal(s.items[0].result, "-");
  assert.equal(s.items[0].was, "C2 ng — 白い画面");
  assert.throws(() => attachSheet(file, { src, only: ["C7"], now: "T3" }), /写す項目がありません: C7/);
});

test("CLI: inbox はシートを指令に数えず、kind と check_sheet の数を出す", () => {
  const repo = mkdtempSync(join(tmpdir(), "mailbox-repo-"));
  writeFileSync(join(repo, "repo.json"), '{"repo_id": "acme-app", "tier": "leaf"}\n');
  const run = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: repo, encoding: "utf8" });
  run("init", "-q", "-b", "main");
  run("commit", "-q", "--allow-empty", "-m", "x");
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("ORDER_")));
  const { dir } = box();
  rmSync(join(dir, "20260101-000000-x.md"));
  const src = join(dirname(dir), "acc.md");
  addItem(src, ITEM, { now: "T1" });
  const boxName = execFileSync("node", [SCRIPT, "self"], { cwd: repo, encoding: "utf8", env: clean }).match(/^self: (\S+)/m)[1];
  const mine = join(dirname(dir), boxName);
  fileCheckOrder({ box: mine, to: "-", from: "x", src, title: "確認" });
  const out = execFileSync("node", [SCRIPT, "inbox"], { cwd: repo, encoding: "utf8", env: { ...clean, ORDER_STATE_DIR: dirname(dir) } });
  assert.match(out, /browser-check\.md\n  from: x\n  kind: browser-check\n  title: 確認\n  need: .*\n  check_sheet: .*\.check\.md \| 1 items \| ok 0 ng 0 skip 0 pending 1\n/);
  assert.equal(out.match(/^open /gm).length, 1);
});
