// scripts/agent-terminal/agentTerminal.test.mjs — pnpm test:agent-terminal
//
// - AGENT_TERMINAL の読み方(環境変数 → default.conf、無い・知らない値 = none)
// - compact:self の 2 つの道(打てない → 代わりの 1 行・待つ役なし / tmux + hook の印あり → 待つ役を残す)
// - hook の標準出力: tmux の値 + tmux の中の SessionStart だけ端末の案内、ほかは空。記録と、手で打った圧縮の後だけ続きの待つ役を残すこと
// - 入力欄の読み取り(空・下書き・薄い案内・確認の画面)

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { planCompactSelf, runCompactSelf } from "./compactSelf.mjs";
import { TERMINALS, boxText, currentPane, guideFile, paneDir, readAgentTerminal, readDefaultFile, writeMark } from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const temps = [];
const temp = (prefix) => {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), prefix)));
  temps.push(dir);
  return dir;
};
after(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

// tmux の中のように見える環境(socket は存在しないので、何かが tmux を呼んでも打ち込まれる先は無い)
const tmuxEnv = (extra = {}) => ({
  HOME: temp("agent-terminal-home-"),
  PATH: process.env.PATH,
  AGENT_TERMINAL: "tmux",
  AGENT_TERMINAL_STATE_DIR: temp("agent-terminal-state-"),
  TMUX: "/nonexistent/agent-terminal-test.sock,1,0",
  TMUX_PANE: "%7",
  ...extra,
});

const recorder = () => {
  const calls = { spawned: [], printed: [] };
  return {
    calls,
    deps: {
      spawn: (cmd, args) => {
        calls.spawned.push(args);
        return { unref() {} };
      },
      print: (line) => calls.printed.push(line),
    },
  };
};

test("readAgentTerminal: 環境変数が先、無ければ default.conf、知らない値は none", () => {
  const dir = temp("agent-terminal-conf-");
  const file = path.join(dir, "default.conf");
  writeFileSync(file, "# 注釈\nAGENT_TERMINAL=tmux # 既定\n");
  assert.equal(readDefaultFile(file), "tmux");
  assert.equal(readAgentTerminal({}, file), "tmux");
  assert.equal(readAgentTerminal({ AGENT_TERMINAL: "none" }, file), "none");
  assert.equal(readAgentTerminal({ AGENT_TERMINAL: "screen" }, file), "none");
  assert.equal(readAgentTerminal({}, path.join(dir, "missing.conf")), "none");
  writeFileSync(file, "AGENT_TERMINAL=kitty\n");
  assert.equal(readAgentTerminal({}, file), "none");
  // 出荷する既定値
  assert.equal(readDefaultFile(), "tmux");
});

test("currentPane: tmux の値・tmux の中・別の道具のタブでない、がそろったときだけ", () => {
  assert.ok(currentPane(tmuxEnv()));
  assert.equal(currentPane(tmuxEnv({ AGENT_TERMINAL: "none" })), null);
  assert.equal(currentPane(tmuxEnv({ TMUX: "" })), null);
  assert.equal(currentPane(tmuxEnv({ TMUX_PANE: "" })), null);
  assert.equal(currentPane(tmuxEnv({ TK_TEAM: "quest" })), null);
  assert.equal(currentPane(tmuxEnv({ LOUNGE_ROLE: "grace" })), null);
});

test("compact:self 打てないとき: 代わりの 1 行を出し、待つ役を残さない(exit 0)", () => {
  for (const env of [tmuxEnv({ AGENT_TERMINAL: "none" }), tmuxEnv({ TMUX: "", TMUX_PANE: "" }), tmuxEnv()]) {
    // 3 つ目 = tmux の中でも hook の印が無い(hook が動いていない)
    const { calls, deps } = recorder();
    assert.equal(runCompactSelf(["状態ファイル", "a.md"], env, deps), 0);
    assert.deepEqual(calls.spawned, []);
    assert.equal(calls.printed.length, 1);
    assert.match(calls.printed[0], /\/compact 状態ファイル a\.md$/);
  }
});

test("compact:self 打てるとき: 返答の終わりの印を添えて待つ役を残す", () => {
  const env = tmuxEnv();
  const dir = paneDir(currentPane(env), env);
  writeMark(dir, "session", "s-1");
  writeMark(dir, "busy", "200");
  writeMark(dir, "idle", "100");
  assert.equal(planCompactSelf(env).mode, "queue");
  const { calls, deps } = recorder();
  assert.equal(runCompactSelf(["残す", "こと\n2 行目"], env, deps), 0);
  assert.equal(calls.spawned.length, 1);
  const [script, purpose, text, prevIdle] = calls.spawned[0];
  assert.equal(path.basename(script), "waiter.mjs");
  assert.equal(purpose, "compact");
  assert.equal(text, "/compact 残す こと 2 行目");
  assert.equal(prevIdle, "100");
  assert.match(calls.printed[0], /予約しました/);
});

test("compact:self 残すことが空なら使い方を出して exit 1", () => {
  const { calls, deps } = recorder();
  assert.equal(runCompactSelf([], tmuxEnv(), deps), 1);
  assert.deepEqual(calls.spawned, []);
});

const runHook = (event, env, input) =>
  spawnSync(process.execPath, [path.join(here, "hook.mjs"), event], { env, input: JSON.stringify(input), encoding: "utf8" });

test("hook: 案内を出すのは tmux の値 + tmux の中の SessionStart だけ。ほかは何も出さず exit 0", () => {
  const guide = readFileSync(guideFile("tmux"), "utf8");
  const cases = [
    [tmuxEnv(), true],
    [tmuxEnv({ AGENT_TERMINAL: "none" }), false],
    [tmuxEnv({ AGENT_TERMINAL: "screen" }), false],
    [tmuxEnv({ TMUX: "" }), false],
    [tmuxEnv({ TK_TEAM: "guild" }), false],
  ];
  for (const [env, inside] of cases) {
    for (const [event, input] of [
      ["start", { session_id: "s-1", source: "startup" }],
      ["busy", { session_id: "s-1", prompt: "hi" }],
      ["stop", { session_id: "s-1" }],
      ["precompact", { session_id: "s-1", trigger: "auto" }],
      ["start", { session_id: "s-1", source: "compact" }],
      ["unknown", {}],
    ]) {
      const r = runHook(event, env, input);
      assert.equal(r.status, 0, `${event}`);
      assert.equal(r.stdout, inside && event === "start" ? guide : "", `${event} stdout`);
      assert.equal(r.stderr, "", `${event} stderr`);
    }
  }
  // 壊れた入力でも黙る(案内は出る: 会話の id が読めなくても端末は同じ)
  const r = spawnSync(process.execPath, [path.join(here, "hook.mjs"), "busy"], { env: tmuxEnv(), input: "{not json", encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
});

test("案内のファイル: none 以外の値ごとに 1 つあり、空でない", () => {
  for (const terminal of TERMINALS.filter((t) => t !== "none")) {
    assert.ok(readFileSync(guideFile(terminal), "utf8").trim().length > 0, terminal);
  }
  assert.equal(existsSync(guideFile("none")), false);
});

test("hook: tmux のときだけペインに印を書く。手で打った圧縮の後だけ続きの待つ役が動く", () => {
  const env = tmuxEnv({ AGENT_TERMINAL_STEP_MS: "50" });
  const dir = paneDir(currentPane(env), env);
  runHook("start", env, { session_id: "s-1", source: "startup" });
  runHook("busy", env, {});
  runHook("stop", env, {});
  const read = (name) => readFileSync(path.join(dir, name), "utf8").trim();
  assert.equal(read("session"), "s-1");
  assert.match(read("busy"), /^\d+$/);
  assert.match(read("idle"), /^\d+$/);

  // 返答の途中の自動圧縮: 続きは打たない(待つ役が残らない = 記録が増えない)
  runHook("precompact", env, { trigger: "auto" });
  runHook("start", env, { session_id: "s-1", source: "compact" });
  // 手で打った圧縮: 待つ役が残る。この試験の socket は無いので「ペインが無い」でやめた記録が残る
  runHook("precompact", env, { trigger: "manual" });
  runHook("start", env, { session_id: "s-1", source: "compact" });
  const deadline = Date.now() + 5000;
  let log = "";
  while (Date.now() < deadline) {
    try {
      log = readFileSync(path.join(dir, "typein.log"), "utf8");
    } catch {
      log = "";
    }
    if (log) break;
    spawnSync("sleep", ["0.1"]);
  }
  const lines = log.trim().split("\n");
  assert.equal(lines.length, 1, log);
  assert.match(lines[0], /\tcontinue\tskip: the pane is gone: 続けてください$/);

  // none のときは何も書かない
  const other = tmuxEnv({ AGENT_TERMINAL_STATE_DIR: env.AGENT_TERMINAL_STATE_DIR, TMUX_PANE: "%8" });
  const otherDir = paneDir(currentPane(other), other);
  runHook("start", { ...other, AGENT_TERMINAL: "none" }, { session_id: "s-2", source: "startup" });
  assert.throws(() => readFileSync(path.join(otherDir, "session")));
});

test("boxText: 空の入力欄・下書き・薄い案内・確認の画面", () => {
  const rule = "─".repeat(40);
  assert.equal(boxText(["過去の発言 ❯ 前の質問", rule, "❯ ", rule, "  ? for shortcuts"].join("\n")), "");
  assert.equal(boxText([rule, "❯ 書きかけ", "2 行目", rule].join("\n")), "書きかけ\n2 行目");
  assert.equal(boxText([rule, '❯ \x1b[2mTry "fix lint errors"\x1b[22m', rule].join("\n")), "");
  assert.equal(boxText(["Do you want to proceed?", "❯ 1. Yes", "  2. No"].join("\n")), null);
  assert.equal(boxText("何も無い"), null);
  // /rename した会話の上の罫線(下の罫線もあること)
  assert.equal(boxText(["──── 作業 1 ─────", "❯ ", rule].join("\n")), "");
  assert.equal(boxText(["──── 作業 1 ─────", "❯ "].join("\n")), null);
});

// 本物の tmux(あるときだけ): 入力欄を描いて 1 行受け取るだけの偽の画面に、待つ役が打ち込む
const hasTmux = spawnSync("tmux", ["-V"]).status === 0;
test("waiter(本物の tmux): 予約した返答が終わってから、空の入力欄に 1 行打つ", { skip: !hasTmux && "tmux が無い" }, async () => {
  const dir = temp("agent-terminal-tmux-");
  const socket = path.join(dir, "sock");
  const got = path.join(dir, "got.txt");
  const fake = path.join(dir, "fake.sh");
  const rule = "─".repeat(30);
  writeFileSync(fake, `printf '%s\\n' '${rule}'; printf '❯ '; IFS= read -r line; printf '%s' "$line" > '${got}'; sleep 30\n`);
  const t = (...args) => spawnSync("tmux", ["-S", socket, ...args], { encoding: "utf8" });
  assert.equal(t("new-session", "-d", "-x", "80", "-y", "10", "bash", fake).status, 0);
  try {
    const paneId = t("display-message", "-p", "#{pane_id}").stdout.trim();
    const env = tmuxEnv({ TMUX: `${socket},1,0`, TMUX_PANE: paneId, AGENT_TERMINAL_STEP_MS: "100" });
    const pdir = paneDir(currentPane(env), env);
    writeMark(pdir, "session", "s-1");
    writeMark(pdir, "busy", "1");
    writeMark(pdir, "idle", "0");
    const waiter = spawnSync(process.execPath, [path.join(here, "waiter.mjs"), "compact", "/compact 残す", "0"], {
      env,
      timeout: 1000,
    });
    // 返答はまだ終わっていない(idle が予約時のまま)→ 1 秒待っても打たない
    assert.equal(waiter.error?.code, "ETIMEDOUT");
    assert.throws(() => readFileSync(got));

    const { spawn } = await import("node:child_process");
    const child = spawn(process.execPath, [path.join(here, "waiter.mjs"), "compact", "/compact 残す", "0"], { env, stdio: "ignore" });
    await new Promise((r) => setTimeout(r, 300));
    writeMark(pdir, "idle", "2"); // 返答が終わった
    await new Promise((r) => child.on("exit", r));
    assert.equal(readFileSync(got, "utf8"), "/compact 残す");
    assert.match(readFileSync(path.join(pdir, "typein.log"), "utf8"), /\tcompact\ttyped: \/compact 残す\n$/);
  } finally {
    t("kill-server");
  }
});
