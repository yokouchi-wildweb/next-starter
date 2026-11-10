// scripts/workflow/peer/peer.hook.test.mjs — pnpm test scripts/workflow/peer
//
// - start: 印(pid・procStart・cwd・mode)を書き、自分の受け箱を作って watchPaths に返す。未読があるときだけ 1 行
// - cwd: start と同じ見張りの一覧(受け持つ箱も)を CwdChanged の watchPaths に返し直し、印の cwd を新しい値にする
// - prompt: 印の mode を今の権限モードに書き直す。未読があれば start と同じ未読の 1 行だけ文脈へ、無ければ何も出さない
// - bell: 自分の受け箱への add だけ stderr に知らせの 1 行(本文・送り手のモードは入れない)+ exit 2、ほかは黙って 0
// - 門が閉じている(tmux でない・tmux の外・id なし)= どれも出さず書かず 0。チームの道具のタブでは動く。実際の hook.mjs も同じ
// - PEER_BOXES: 受け持つ箱も見張り、印に書き、そこへの add でも鳴る。渡されなかったセッションは箱を持たない
// - .claude/settings.json の行(SessionStart・UserPromptSubmit・FileChanged + asyncRewake・CwdChanged)と peer の 6 動作の allow

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { bellLine, runHook } from "./lib.hook.mjs";
import { boxDir, claudePid, putMessage, readMark, setState } from "./lib.store.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, "../../..");
const temps = [];
const temp = () => {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "peer-hook-test-")));
  temps.push(dir);
  return dir;
};
after(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const SELF = "self-1111";
const openEnv = (root, extra = {}) => ({
  AGENT_TERMINAL: "tmux",
  TMUX: "/tmp/peer-hook-test.sock,1,0",
  TMUX_PANE: "%4",
  CLAUDE_CODE_SESSION_ID: SELF,
  PEER_STATE_DIR: root,
  ...extra,
});
const depsFor = (root, extra = {}, pid = 4242) => ({
  env: openEnv(root, extra),
  claudePid: () => pid,
  procStart: (p) => `start-${p}`,
  now: () => new Date("2026-11-08T10:00:00Z"),
});
const from = { name: "alpha", sessionId: "a-1", cwd: "/w/repo-a" };

test("start: 印と受け箱を作り、watchPaths に自分の箱だけを返す(未読なしなら文脈に何も足さない)", () => {
  const root = temp();
  const r = runHook("start", { source: "startup", cwd: "/w/me", permission_mode: "plan" }, depsFor(root));
  assert.equal(r.code, 0);
  const out = JSON.parse(r.stdout).hookSpecificOutput;
  assert.deepEqual(out, { hookEventName: "SessionStart", watchPaths: [boxDir(root, SELF)] });
  assert.ok(existsSync(boxDir(root, SELF)));
  const mark = readMark(root, SELF);
  assert.equal(mark.pid, 4242);
  assert.equal(mark.procStart, "start-4242");
  assert.equal(mark.cwd, "/w/me");
  assert.equal(mark.mode, "plan");
});

test("start: どの source でも毎回 watchPaths を返す。未読があれば 1 行だけ", () => {
  const root = temp();
  const a = putMessage(root, SELF, { from, body: "x" });
  const b = putMessage(root, SELF, { from, body: "y" });
  setState(root, SELF, a.id, "read");
  for (const source of ["startup", "resume", "clear", "compact", "fork"]) {
    const out = JSON.parse(runHook("start", { source }, depsFor(root)).stdout).hookSpecificOutput;
    assert.deepEqual(out.watchPaths, [boxDir(root, SELF)]);
    assert.match(out.additionalContext, new RegExp(`未読の連絡が 1 件.*${b.id}.*pnpm workflow peer inbox`));
    assert.equal(out.additionalContext.includes("\n"), false);
    assert.equal(out.additionalContext.includes("y"), false);
  }
});

test("start: claude の pid が分からなければ印を書かない(見張りは返す)", () => {
  const root = temp();
  const r = runHook("start", {}, depsFor(root, {}, null));
  assert.equal(readMark(root, SELF), null);
  assert.deepEqual(JSON.parse(r.stdout).hookSpecificOutput.watchPaths, [boxDir(root, SELF)]);
});

test("prompt: 印の mode を今の権限モードに書き直し、何も出さない。値が無ければ前の値のまま", () => {
  const root = temp();
  runHook("start", { permission_mode: "default" }, depsFor(root));
  const r = runHook("prompt", { permission_mode: "acceptEdits" }, depsFor(root));
  assert.deepEqual(r, { stdout: "", stderr: "", code: 0 });
  assert.equal(readMark(root, SELF).mode, "acceptEdits");
  runHook("prompt", {}, depsFor(root));
  assert.equal(readMark(root, SELF).mode, "acceptEdits");
});

test("bell: 自分の受け箱への add だけ 1 行 + exit 2。本文・送り手のモードは入れない", () => {
  const root = temp();
  const m = putMessage(root, SELF, { from, senderMode: "bypassPermissions", about: "棚", body: "ひみつの本文" });
  const file = path.join(boxDir(root, SELF), `${m.id}.json`);
  const r = runHook("bell", { hook_event_name: "FileChanged", file_path: file, event: "add" }, depsFor(root));
  assert.equal(r.code, 2);
  assert.equal(r.stdout, "");
  assert.equal(r.stderr, `${bellLine(m)}\n`);
  assert.match(r.stderr, new RegExp(`alpha\\(repo:repo-a\\)から連絡 ${m.id}\\(about: 棚\\).*pnpm workflow peer read ${m.id}`));
  assert.equal(r.stderr.includes("ひみつの本文"), false);
  assert.equal(r.stderr.includes("bypassPermissions"), false);
  assert.equal(r.stderr.trim().includes("\n"), false);
  const reply = putMessage(root, SELF, { from, replyTo: m.id, body: "z" });
  assert.match(bellLine(reply), new RegExp(`返事\\(${m.id} への\\)`));
});

test("bell: 他人の箱・tmp・change / unlink・連絡でないファイル・読めない連絡 → 黙って 0", () => {
  const root = temp();
  const m = putMessage(root, SELF, { from, body: "x" });
  const own = path.join(boxDir(root, SELF), `${m.id}.json`);
  const other = putMessage(root, "other-2222", { from, body: "x" });
  const cases = [
    { file_path: own, event: "change" },
    { file_path: own, event: "unlink" },
    { file_path: path.join(boxDir(root, "other-2222"), `${other.id}.json`), event: "add" },
    { file_path: path.join(root, "tmp", `${m.id}.json`), event: "add" },
    { file_path: path.join(boxDir(root, SELF), "notes.txt"), event: "add" },
    { file_path: path.join(boxDir(root, SELF), "m-20260101T000000-ffff.json"), event: "add" },
    {},
  ];
  for (const input of cases) assert.deepEqual(runHook("bell", input, depsFor(root)), { stdout: "", stderr: "", code: 0 });
});

test("門が閉じている → start / cwd / prompt / bell とも出さず書かず 0", () => {
  for (const extra of [{ AGENT_TERMINAL: "none" }, { TMUX: "" }, { CLAUDE_CODE_SESSION_ID: "" }]) {
    const root = temp();
    for (const mode of ["start", "cwd", "prompt", "bell"]) {
      assert.deepEqual(runHook(mode, { permission_mode: "plan", event: "add", file_path: "/x" }, depsFor(root, extra)), {
        stdout: "",
        stderr: "",
        code: 0,
      });
    }
    assert.equal(existsSync(path.join(root, "marks")), false);
    assert.equal(existsSync(path.join(root, "boxes")), false);
  }
});

test("hook.mjs そのもの: チームの道具のタブでも動き、PEER_BOXES を渡されたセッションだけが箱を受け持つ", () => {
  const root = temp();
  const run = (mode, env, input = {}) =>
    spawnSync(process.execPath, [path.join(here, "hook.mjs"), mode], { input: JSON.stringify(input), encoding: "utf8", env: { PATH: process.env.PATH, ...env } });
  const team = run("start", { ...openEnv(root), TK_TEAM: "council", PEER_BOXES: "council/r1" });
  assert.equal(team.status, 0);
  assert.deepEqual(JSON.parse(team.stdout).hookSpecificOutput.watchPaths, [boxDir(root, SELF), boxDir(root, "council/r1")]);
  // 席のタブ: 同じチームの環境でも PEER_BOXES を渡されなければ自分の会話の箱だけ
  const seat = run("start", { ...openEnv(root), TK_TEAM: "council", CLAUDE_CODE_SESSION_ID: "seat-3333" });
  assert.deepEqual(JSON.parse(seat.stdout).hookSpecificOutput.watchPaths, [boxDir(root, "seat-3333")]);
  const open = run("start", openEnv(root), { source: "startup" });
  assert.equal(open.status, 0);
  assert.deepEqual(JSON.parse(open.stdout).hookSpecificOutput.watchPaths, [boxDir(root, SELF)]);
  const broken = spawnSync(process.execPath, [path.join(here, "hook.mjs"), "bell"], { input: "not json", encoding: "utf8", env: { PATH: process.env.PATH, ...openEnv(root) } });
  assert.equal(broken.status, 0);
});

test("claudePid: 先祖をたどって comm が claude の最初の pid、無ければ null", () => {
  const tree = { 10: [9, "bash"], 9: [8, "node"], 8: [7, "claude"], 7: [1, "bash"] };
  const deps = { parent: (p) => tree[p]?.[0] ?? null, comm: (p) => tree[p]?.[1] ?? null };
  assert.equal(claudePid(10, deps), 8);
  assert.equal(claudePid(7, deps), null);
});

test(".claude/settings.json: peer のフックの行と 5 動作の allow", () => {
  const s = JSON.parse(readFileSync(path.join(repo, ".claude/settings.json"), "utf8"));
  const cmds = (event) => (s.hooks[event] ?? []).flatMap((g) => g.hooks);
  const peer = (event, mode) => cmds(event).find((h) => h.command === `node "$CLAUDE_PROJECT_DIR/scripts/workflow/peer/hook.mjs" ${mode}`);
  assert.ok(peer("SessionStart", "start"));
  assert.ok(cmds("SessionStart").some((h) => h.command.includes("agent-terminal/hook.mjs")));
  assert.ok(peer("UserPromptSubmit", "prompt"));
  const cwd = peer("CwdChanged", "cwd");
  assert.ok(cwd);
  assert.equal(s.hooks.CwdChanged.find((g) => g.hooks.includes(cwd)).matcher, undefined);
  const bell = peer("FileChanged", "bell");
  assert.equal(bell.asyncRewake, true);
  assert.equal(bell.timeout, 30);
  assert.equal(
    s.hooks.FileChanged.find((g) => g.hooks.includes(bell)).matcher,
    undefined,
  );
  for (const a of ["send", "reply", "inbox", "read", "ack", "who"]) assert.ok(s.permissions.allow.includes(`Bash(pnpm workflow peer ${a}:*)`), a);
});

test("PEER_BOXES: start は受け持つ箱も作って見張り、印に書く。prompt も保つ。使えない値は 1 行", () => {
  const root = temp();
  const r = runHook("start", { permission_mode: "plan" }, depsFor(root, { PEER_BOXES: "council/r1 guild/g1 ../bad" }));
  const out = JSON.parse(r.stdout).hookSpecificOutput;
  assert.deepEqual(out.watchPaths, [boxDir(root, SELF), boxDir(root, "council/r1"), boxDir(root, "guild/g1")]);
  assert.ok(existsSync(boxDir(root, "guild/g1")));
  assert.deepEqual(readMark(root, SELF).boxes, ["council/r1", "guild/g1"]);
  assert.match(out.additionalContext, /PEER_BOXES の値 \.\.\/bad は箱の鍵/);
  runHook("prompt", { permission_mode: "default" }, depsFor(root, { PEER_BOXES: "council/r1 guild/g1" }));
  assert.deepEqual(readMark(root, SELF).boxes, ["council/r1", "guild/g1"]);
  runHook("start", {}, depsFor(root));
  assert.deepEqual(readMark(root, SELF).boxes, []);
});

test("bell: 受け持つ箱への add でも鳴り、行は箱を名指す。受け持たない箱は黙る", () => {
  const root = temp();
  const env = { PEER_BOXES: "council/r1" };
  const m = putMessage(root, "council/r1", { from, about: "件", body: "x" });
  const r = runHook("bell", { event: "add", file_path: path.join(boxDir(root, "council/r1"), `${m.id}.json`) }, depsFor(root, env));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /連絡\(受け持つ箱 council\/r1 宛て\) m-/);
  const o = putMessage(root, "council/q9", { from, body: "x" });
  assert.equal(runHook("bell", { event: "add", file_path: path.join(boxDir(root, "council/q9"), `${o.id}.json`) }, depsFor(root, env)).code, 0);
  assert.equal(runHook("bell", { event: "add", file_path: path.join(boxDir(root, "council/r1"), `${m.id}.json`) }, depsFor(root)).code, 0);
});

test("印の欄を足しても版は 1: 古い読み手(v === 1 を読み知らない欄は通す)で読める", () => {
  const root = temp();
  runHook("start", {}, depsFor(root, { PEER_BOXES: "council/r1" }));
  const raw = JSON.parse(readFileSync(path.join(root, "marks", `${SELF}.json`), "utf8"));
  assert.equal(raw.v, 1);
  const oldReader = (d) => (d && d.v === 1 ? d : null);
  assert.equal(oldReader(raw).pid, 4242);
});

test("start: 形の崩れた連絡(id の欠け)があっても watchPaths を返し、未読は受け持つ箱も数え、読めない件数を 1 行", () => {
  const root = temp();
  const env = { PEER_BOXES: "council/r1" };
  mkdirSync(boxDir(root, SELF), { recursive: true });
  writeFileSync(path.join(boxDir(root, SELF), "x.json"), JSON.stringify({ v: 1, body: "id なし" }));
  mkdirSync(boxDir(root, "council/r1"), { recursive: true });
  writeFileSync(path.join(boxDir(root, "council/r1"), "m5.json"), JSON.stringify({ v: 1, id: "m5", from, body: "移した連絡", sentAt: "2026-11-01T00:00:00Z" }));
  const out = JSON.parse(runHook("start", {}, depsFor(root, env)).stdout).hookSpecificOutput;
  assert.deepEqual(out.watchPaths, [boxDir(root, SELF), boxDir(root, "council/r1")]);
  assert.match(out.additionalContext, /未読の連絡が 1 件.*m5/);
  assert.match(out.additionalContext, /読めない連絡 1 件\(この会話の箱\)/);
});

test("bell: 元の番号 m<N> の連絡でも鳴る。読めない連絡では鳴らない", () => {
  const root = temp();
  const env = { PEER_BOXES: "council/r1" };
  mkdirSync(boxDir(root, "council/r1"), { recursive: true });
  const f = path.join(boxDir(root, "council/r1"), "m12.json");
  writeFileSync(f, JSON.stringify({ v: 1, id: "m12", from, about: "移し", body: "x", sentAt: "2026-11-01T00:00:00Z" }));
  const r = runHook("bell", { event: "add", file_path: f }, depsFor(root, env));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /連絡\(受け持つ箱 council\/r1 宛て\) m12/);
  const g = path.join(boxDir(root, "council/r1"), "m13.json");
  writeFileSync(g, "{ broken");
  assert.equal(runHook("bell", { event: "add", file_path: g }, depsFor(root, env)).code, 0);
});

test("cwd: start と同じ見張りの一覧(受け持つ箱も)を CwdChanged で返し直し、印の cwd を新しい値にする。文脈には何も足さない", () => {
  const root = temp();
  const env = { PEER_BOXES: "council/r1" };
  putMessage(root, SELF, { from, body: "未読があっても cwd は 1 行を出さない" });
  const start = JSON.parse(runHook("start", { cwd: "/w/repo" }, depsFor(root, env)).stdout).hookSpecificOutput;
  rmSync(boxDir(root, "council/r1"), { recursive: true, force: true });
  const r = runHook("cwd", { cwd: "/w/repo/sub", old_cwd: "/w/repo", new_cwd: "/w/repo/sub" }, depsFor(root, env));
  assert.equal(r.code, 0);
  assert.equal(r.stderr, "");
  const out = JSON.parse(r.stdout).hookSpecificOutput;
  assert.deepEqual(out, { hookEventName: "CwdChanged", watchPaths: start.watchPaths });
  assert.ok(existsSync(boxDir(root, "council/r1")));
  assert.equal(readMark(root, SELF).cwd, "/w/repo/sub");
  assert.deepEqual(readMark(root, SELF).boxes, ["council/r1"]);
  // new_cwd が無ければ cwd の欄
  runHook("cwd", { cwd: "/w/repo/other" }, depsFor(root, env));
  assert.equal(readMark(root, SELF).cwd, "/w/repo/other");
});

test("prompt: 未読があれば start と同じ未読の 1 行(受け持つ箱も・古い順)、読めば出ない。読めない連絡があっても止まらない", () => {
  const root = temp();
  const env = { PEER_BOXES: "council/r1" };
  runHook("start", {}, depsFor(root, env));
  const a = putMessage(root, "council/r1", { from, body: "x" });
  mkdirSync(boxDir(root, SELF), { recursive: true });
  writeFileSync(path.join(boxDir(root, SELF), "x.json"), "{ not json");
  const r = runHook("prompt", { permission_mode: "default" }, depsFor(root, env));
  assert.equal(r.code, 0);
  const out = JSON.parse(r.stdout).hookSpecificOutput;
  assert.equal(out.hookEventName, "UserPromptSubmit");
  assert.match(out.additionalContext, new RegExp(`未読の連絡が 1 件あります\\(古い順: ${a.id}\\)`));
  assert.equal(out.additionalContext.includes("\n"), false);
  const startLine = JSON.parse(runHook("start", {}, depsFor(root, env)).stdout).hookSpecificOutput.additionalContext.split("\n")[0];
  assert.equal(out.additionalContext, startLine);
  assert.equal(readMark(root, SELF).mode, "default");
  setState(root, "council/r1", a.id, "read");
  assert.deepEqual(runHook("prompt", {}, depsFor(root, env)), { stdout: "", stderr: "", code: 0 });
});

test("hook.mjs そのもの: cwd は CwdChanged の watchPaths を返す", () => {
  const root = temp();
  const r = spawnSync(process.execPath, [path.join(here, "hook.mjs"), "cwd"], {
    input: JSON.stringify({ new_cwd: "/w/x" }),
    encoding: "utf8",
    env: { PATH: process.env.PATH, ...openEnv(root), PEER_BOXES: "guild/g1" },
  });
  assert.equal(r.status, 0);
  assert.deepEqual(JSON.parse(r.stdout).hookSpecificOutput, { hookEventName: "CwdChanged", watchPaths: [boxDir(root, SELF), boxDir(root, "guild/g1")] });
});
