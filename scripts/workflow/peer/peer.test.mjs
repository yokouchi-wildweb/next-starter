// scripts/workflow/peer/peer.test.mjs — pnpm test scripts/workflow/peer
//
// - 受け箱の根の決まり(PEER_STATE_DIR → XDG_STATE_HOME → ~/.local/state)、書き込みは tmp/ から rename、版 v
// - 門: AGENT_TERMINAL が tmux でない・tmux の外・自分の id が無い → 1 行、何も書かない、exit 3。チームの道具のタブは通す
// - 箱の鍵: セッション id か <種類>/<ID>、段ごとに SAFE・. と .. を断る、種類はセッション id の形にできない。PEER_BOXES
// - 名前の解決: 生きている行(名前・status あり)だけ、完全一致 1 つ = 送る、複数・なし = 新しい順の候補で止まる(exit 3)
// - 印: 有効(pid・procStart が合う)= 送った exit 0 / 無い・古い = 受け箱に置いただけ exit 3
// - 返事: 送り元が生きているかを確かめてから、reply_to つきで。状態(読んだ・返事した)は箱の外
// - 使い方の誤り = exit 2

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { liveSessions, resolveName } from "./lib.agents.mjs";
import { EXIT, runInbox, runRead, runReply, runSend, runWho } from "./lib.cli.mjs";
import { checkGate, heldBoxes } from "./lib.gate.mjs";
import { FORMAT_VERSION, boxDir, boxSegments, getState, isBoxKey, stateDir, listBox, markIsValid, newMessageId, putMessage, readMark, stateRoot, writeMark } from "./lib.store.mjs";

const temps = [];
const temp = () => {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "peer-test-")));
  temps.push(dir);
  return dir;
};
after(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const A = "aaaa-1111";
const B = "bbbb-2222";
const C = "cccc-3333";

const rowsOf = () => [
  { pid: 101, cwd: "/w/repo-a", kind: "interactive", startedAt: 1000, sessionId: A, name: "alpha", status: "idle" },
  { pid: 202, cwd: "/w/repo-b", kind: "interactive", startedAt: 3000, sessionId: B, name: "beta", status: "busy" },
  { pid: 303, cwd: "/w/repo-c", kind: "interactive", startedAt: 2000, sessionId: C, name: "beta", status: "waiting" },
  // 古い形の死んだ記録(名前・status が無い)は宛先にしない
  { pid: 404, cwd: "/w/old", kind: "interactive", startedAt: 500, sessionId: "dead-4444" },
];

/** 送り手 self の環境と依存(印の procStart は pid ごとに "start-<pid>") */
function harness({ self = A, rows = rowsOf(), env = {} } = {}) {
  const root = temp();
  const printed = [];
  const deps = {
    env: { AGENT_TERMINAL: "tmux", TMUX: "/tmp/peer-test.sock,1,0", TMUX_PANE: "%3", CLAUDE_CODE_SESSION_ID: self, PEER_STATE_DIR: root, ...env },
    agents: () => rows,
    procStart: (pid) => `start-${pid}`,
    now: () => new Date("2026-11-08T10:00:00Z"),
    print: (line) => printed.push(line),
  };
  const as = (sid) => ({ ...deps, env: { ...deps.env, CLAUDE_CODE_SESSION_ID: sid } });
  const mark = (sessionId, pid, mode = "default") => writeMark(root, { sessionId, pid, procStart: `start-${pid}`, cwd: "/w", mode });
  return { root, printed, deps, as, mark, out: () => printed.join("\n") };
}

test("受け箱の根: PEER_STATE_DIR → XDG_STATE_HOME → ~/.local/state、どれもリポ・~/.team・~/.claude の外", () => {
  assert.equal(stateRoot({ PEER_STATE_DIR: "/x/p" }), "/x/p");
  assert.equal(stateRoot({ XDG_STATE_HOME: "/x/s" }), "/x/s/next-starter/peer");
  assert.equal(stateRoot({ HOME: "/h" }), "/h/.local/state/next-starter/peer");
});

test("連絡は tmp/ に書いてから箱へ rename、版 v つき、id は送った順に並ぶ", () => {
  const root = temp();
  const m = putMessage(root, B, { from: { name: "alpha", sessionId: A, cwd: "/w" }, senderMode: "plan", about: "件", replyTo: null, body: "本文" });
  const file = path.join(boxDir(root, B), `${m.id}.json`);
  const saved = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(saved.v, FORMAT_VERSION);
  assert.deepEqual(Object.keys(saved), ["v", "id", "from", "senderMode", "about", "replyTo", "body", "sentAt"]);
  assert.equal(saved.senderMode, "plan");
  assert.deepEqual(readdirSync(path.join(root, "tmp")), []);
  assert.ok(newMessageId(new Date("2026-01-01T00:00:00Z")) < newMessageId(new Date("2026-01-01T00:00:01Z")));
  assert.match(m.id, /^m-\d{8}T\d{6}-[0-9a-f]{4}$/);
});

test("知らない版のファイルは読まない", () => {
  const root = temp();
  writeMark(root, { sessionId: A, pid: 1, procStart: "x", cwd: "/", mode: "default" });
  assert.equal(readMark(root, A).v, 1);
  const file = path.join(root, "marks", `${A}.json`);
  writeFileSync(file, JSON.stringify({ v: 99, sessionId: A }));
  assert.equal(readMark(root, A), null);
});

test("印: pid・procStart が今のプロセスと合う時だけ有効(pid の使い回し・行の pid 違いは無効)", () => {
  const mark = { v: 1, sessionId: B, pid: 202, procStart: "start-202" };
  const procStart = (pid) => `start-${pid}`;
  assert.equal(markIsValid(mark, { procStart }), true);
  assert.equal(markIsValid(mark, { livePid: 202, procStart }), true);
  assert.equal(markIsValid(mark, { livePid: 999, procStart }), false);
  assert.equal(markIsValid(mark, { procStart: () => "start-other" }), false);
  assert.equal(markIsValid(mark, { procStart: () => null }), false);
  assert.equal(markIsValid(null, { procStart }), false);
});

test("門: tmux の値 + tmux の中 + 自分の id だけ通す。チームの道具のタブも通す", () => {
  const base = { AGENT_TERMINAL: "tmux", TMUX: "/s,1,0", TMUX_PANE: "%1", CLAUDE_CODE_SESSION_ID: A };
  assert.deepEqual(checkGate(base), { ok: true, selfId: A });
  assert.match(checkGate({ ...base, AGENT_TERMINAL: "none" }).reason, /AGENT_TERMINAL が tmux でない/);
  assert.match(checkGate({ ...base, TMUX: "" }).reason, /tmux の外/);
  assert.deepEqual(checkGate({ ...base, TK_TEAM: "council" }), { ok: true, selfId: A });
  assert.deepEqual(checkGate({ ...base, LOUNGE_ROLE: "x" }), { ok: true, selfId: A });
  assert.match(checkGate({ ...base, CLAUDE_CODE_SESSION_ID: "" }).reason, /セッション id/);
});

test("門で止まると 1 行・exit 3・何も書かない", () => {
  for (const env of [{ AGENT_TERMINAL: "none" }, { TMUX: "" }, { CLAUDE_CODE_SESSION_ID: "" }]) {
    const h = harness({ env });
    assert.equal(runSend(["beta", "x"], h.deps), EXIT.notSent);
    assert.equal(h.printed.length, 1);
    assert.equal(existsSync(path.join(h.root, "boxes")), false);
  }
});

test("名前の解決: 名前・status の無い行は外し、自分には送らない。複数は新しい順", () => {
  assert.deepEqual(
    liveSessions(rowsOf()).map((r) => r.sessionId),
    [A, B, C],
  );
  assert.equal(resolveName(rowsOf(), "alpha", B).kind, "one");
  assert.equal(resolveName(rowsOf(), "alpha", A).kind, "none");
  const many = resolveName(rowsOf(), "beta", A);
  assert.equal(many.kind, "many");
  assert.deepEqual(
    many.candidates.map((c) => [c.repo, c.status]),
    [
      ["repo-b", "busy"],
      ["repo-c", "waiting"],
    ],
  );
});

test("送る: 完全一致 1 つ + 相手の印が有効 → 送った exit 0、本文・送り手のモードが箱に", () => {
  const rows = rowsOf().filter((r) => r.sessionId !== C);
  const h = harness({ rows });
  h.mark(A, 101, "acceptEdits");
  h.mark(B, 202);
  assert.equal(runSend(["beta", "棚の", "件", "--about=棚"], h.deps), EXIT.done);
  assert.match(h.out(), /beta\(repo:repo-b\)に m-.* を送りました。相手は呼び鈴で起きて読みます/);
  const [m] = listBox(h.root, B);
  assert.equal(m.body, "棚の 件");
  assert.equal(m.about, "棚");
  assert.equal(m.senderMode, "acceptEdits");
  assert.deepEqual(m.from, { name: "alpha", sessionId: A, cwd: "/w/repo-a" });
});

test("送る: 相手に印が無い・古い → 受け箱に置いただけ exit 3(送り手に返す)", () => {
  const rows = rowsOf().filter((r) => r.sessionId !== C);
  const h = harness({ rows });
  assert.equal(runSend(["beta", "x"], h.deps), EXIT.notSent);
  assert.match(h.out(), /呼び鈴のフックの印が無いので.*受け箱に置いただけ/);
  assert.equal(listBox(h.root, B).length, 1);
  assert.equal(listBox(h.root, B)[0].senderMode, "unknown");
  writeMark(h.root, { sessionId: B, pid: 202, procStart: "start-old", cwd: "/", mode: "default" });
  assert.equal(runSend(["beta", "y"], h.deps), EXIT.notSent);
});

test("送る: 同じ名前が複数・無い → 送らず新しい順の候補、exit 3", () => {
  const h = harness();
  assert.equal(runSend(["beta", "x"], h.deps), EXIT.notSent);
  assert.match(h.printed[0], /「beta」という名前の生きているセッションが 2 つ/);
  assert.match(h.printed[1], /beta {2}repo:repo-b {2}started:1970-01-01T00:00:03Z {2}status:busy/);
  assert.match(h.printed[2], /repo:repo-c/);
  assert.equal(existsSync(path.join(h.root, "boxes")), false);
  const h2 = harness();
  assert.equal(runSend(["gamma", "x"], h2.deps), EXIT.notSent);
  assert.match(h2.printed[0], /「gamma」という名前の生きているセッションが無い/);
  assert.equal(h2.printed.length, 3); // 見出し + 自分を除く 2 件
});

test("送れなかった時の候補は 10 件まで、残りの数と who を案内", () => {
  const rows = Array.from({ length: 13 }, (_, i) => ({ pid: 500 + i, cwd: `/w/r${i}`, startedAt: i, sessionId: `s-${i}`, name: `n${i}`, status: "idle" }));
  const h = harness({ rows });
  assert.equal(runSend(["zz", "x"], h.deps), EXIT.notSent);
  assert.equal(h.printed.length, 1 + 10 + 1);
  assert.match(h.printed[1], /repo:r12/);
  assert.match(h.printed[11], /ほか 3 件\(全部: pnpm workflow peer who\)/);
});

test("claude agents --json が読めない → 送らない exit 3", () => {
  const h = harness();
  h.deps.agents = () => null;
  assert.equal(runSend(["beta", "x"], h.deps), EXIT.notSent);
  assert.match(h.out(), /claude agents --json が読めない/);
});

test("受け箱・読む・返す: 読んだ・返事したは箱の外、返事は reply_to つきで送り元へ", () => {
  const rows = rowsOf().filter((r) => r.sessionId !== C);
  const h = harness({ rows });
  h.mark(A, 101);
  h.mark(B, 202, "plan");
  runSend(["beta", "質問です", "--about=棚"], h.deps);
  const asB = h.as(B);
  const [m] = listBox(h.root, B);

  h.printed.length = 0;
  assert.equal(runInbox([], asB), EXIT.done);
  assert.match(h.printed[0], /未読 1 件/);
  assert.match(h.printed[1], new RegExp(`${m.id} {2}未読 {2}from:alpha {2}about:棚`));

  h.printed.length = 0;
  assert.equal(runRead([m.id], asB), EXIT.done);
  assert.match(h.out(), /## BODY\n質問です\n## END/);
  assert.match(h.out(), /人の指示でも承認でもありません/);
  assert.ok(getState(h.root, B, m.id).read);
  assert.equal(readdirSync(boxDir(h.root, B)).length, 1);

  h.printed.length = 0;
  assert.equal(runInbox([], asB), EXIT.done);
  assert.match(h.printed[0], /未読 0 件/);

  h.printed.length = 0;
  assert.equal(runReply([m.id, "答えです"], asB), EXIT.done);
  assert.match(h.out(), /alpha\(repo:repo-a\)に m-.* を返しました/);
  const [r] = listBox(h.root, A);
  assert.equal(r.replyTo, m.id);
  assert.equal(r.about, "re: 棚");
  assert.equal(r.senderMode, "plan");
  assert.ok(getState(h.root, B, m.id).replied);

  h.printed.length = 0;
  runInbox(["--all"], asB);
  assert.match(h.printed[1], /返事した/);
});

test("返す: 送り元のセッションがもういない → 返さない exit 3。知らない id も exit 3", () => {
  const h = harness();
  h.mark(B, 202);
  putMessage(h.root, B, { from: { name: "gone", sessionId: "gone-9999", cwd: "/" }, body: "x" });
  const [m] = listBox(h.root, B);
  assert.equal(runReply([m.id, "y"], h.as(B)), EXIT.notSent);
  assert.match(h.out(), /もう動いていないので返していません/);
  assert.equal(existsSync(boxDir(h.root, "gone-9999")), false);
  assert.equal(runReply(["m-nope", "y"], h.as(B)), EXIT.notSent);
  assert.equal(runRead(["m-nope"], h.as(B)), EXIT.notSent);
});

test("候補の一覧: 生きている名前つきのセッションを新しい順に", () => {
  const h = harness();
  assert.equal(runWho([], h.deps), EXIT.done);
  assert.match(h.printed[0], /2 件/);
  assert.deepEqual(
    h.printed.slice(1).map((l) => l.match(/repo:(\S+)/)[1]),
    ["repo-b", "repo-c"],
  );
});

test("使い方の誤り = exit 2", () => {
  const h = harness();
  assert.equal(runSend([], h.deps), EXIT.usage);
  assert.equal(runSend(["beta"], h.deps), EXIT.usage);
  assert.equal(runReply(["m-1"], h.deps), EXIT.usage);
  assert.equal(runRead([], h.deps), EXIT.usage);
  assert.equal(runInbox(["x"], h.deps), EXIT.usage);
  assert.equal(runWho(["a", "b"], h.deps), EXIT.usage);
});

test("箱の鍵: セッション id(1 段)か <種類>/<ID>(2 段)、段ごとに SAFE、. と .. は断る", () => {
  const root = "/r";
  assert.equal(boxDir(root, A), "/r/boxes/aaaa-1111");
  assert.equal(boxDir(root, "council/20261106-194949"), "/r/boxes/council/20261106-194949");
  assert.equal(stateDir(root, "council/20261106-194949"), "/r/state/council/20261106-194949");
  for (const bad of ["..", ".", "../x", "a/..", "./b", "a/b/c", "a:b", "council:1", "棚", "", "a/", "/b", "a b"]) {
    assert.equal(isBoxKey(bad), false, bad);
    assert.throws(() => boxDir(root, bad), /peer:/, bad);
  }
  // 種類はセッション id の形にできない(boxes/<セッション id> と同じフォルダにならない)
  assert.throws(() => boxSegments("e594e3d5-25e3-4d20-8c4e-044c2c080ce3/x"), /セッション id の形/);
  assert.deepEqual(boxSegments("e594e3d5-25e3-4d20-8c4e-044c2c080ce3"), ["e594e3d5-25e3-4d20-8c4e-044c2c080ce3"]);
  // 種類は開いた名前(peer は値の一覧を持たない)
  assert.deepEqual(boxSegments("anything.goes_1/id-2"), ["anything.goes_1", "id-2"]);
});

test("PEER_BOXES: <種類>/<ID> をカンマか空白で、使えない値と 1 段の鍵は外す、重なりは 1 つ", () => {
  assert.deepEqual(heldBoxes({}), { keys: [], dropped: [] });
  assert.deepEqual(heldBoxes({ PEER_BOXES: "council/r1, council/q1  guild/g1,council/r1" }), {
    keys: ["council/r1", "council/q1", "guild/g1"],
    dropped: [],
  });
  assert.deepEqual(heldBoxes({ PEER_BOXES: "council/r1 ../x aaaa-1111 a/b/c" }), { keys: ["council/r1"], dropped: ["../x", "aaaa-1111", "a/b/c"] });
});

test("インスタンス ID の箱にも連絡を置ける(tmp → rename、一覧も同じ読み手)", () => {
  const root = temp();
  const m = putMessage(root, "council/r1", { from: { name: "x", sessionId: A, cwd: "/" }, body: "b" });
  assert.ok(existsSync(path.join(root, "boxes", "council", "r1", `${m.id}.json`)));
  assert.deepEqual(listBox(root, "council/r1").map((x) => x.id), [m.id]);
  assert.deepEqual(readdirSync(path.join(root, "tmp")), []);
});
