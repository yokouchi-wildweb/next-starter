// scripts/workflow/dev-tab/dev-tab.test.ts
//
// 純粋な部品の単体テストと、通しのテスト(小さな HTTP サーバーを dev スクリプトとして立てて止める):
// 裏のプロセス(AGENT_TERMINAL=none・--background)はいつも、タブは tmux があるときだけ(専用の tmux サーバー -L devtab-test-<pid>)。

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import {
  DEV_COMMAND_PATTERN,
  ancestorPids,
  buildDevCommand,
  decideMode,
  detectPackageManager,
  hasTmux,
  isGroupAlive,
  isPortAnswering,
  isUnder,
  liveState,
  pickPort,
  procStartOf,
  readState,
  sessionSlug,
  socketFromTmuxEnv,
  writeState,
  type DevTabBackgroundState,
} from "./lib";

test("decideMode: --background・none・tmux が無い → 裏、名指し(--session / --socket)と tmux → タブ、--background と名指しは誤り", () => {
  const base = { background: false, session: null, socket: null, terminal: "tmux", hasTmux: true };
  assert.equal(decideMode(base), "tab");
  assert.equal(decideMode({ ...base, terminal: "none" }), "background");
  assert.equal(decideMode({ ...base, hasTmux: false }), "background");
  assert.equal(decideMode({ ...base, background: true }), "background");
  assert.equal(decideMode({ ...base, background: true, terminal: "none" }), "background");
  // チームツールの呼び方(tmux の行き先の名指し)は AGENT_TERMINAL=none でもタブ
  assert.equal(decideMode({ ...base, terminal: "none", socket: "team", session: "council-1" }), "tab");
  assert.equal(decideMode({ ...base, terminal: "none", session: "s1" }), "tab");
  assert.equal(decideMode({ ...base, background: true, session: "s1" }), null);
  assert.equal(decideMode({ ...base, background: true, socket: "x" }), null);
});

test("liveState(裏): pid の開始時刻の印が記録と同じ時だけ生きている。違えば(pid の使い回し)・無ければ記録を消す", () => {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "devtab-live-")));
  try {
    const state: DevTabBackgroundState = {
      mode: "background",
      dir: root,
      port: 3999,
      pid: 4242,
      pgid: 4242,
      procStart: "1000",
      log: ".agent/dev-tab.log",
      command: "x",
      startedAt: "2026-11-11T00:00:00Z",
    };
    writeState(root, state);
    assert.deepEqual(liveState(root, () => "1000"), state);
    assert.equal(liveState(root, () => "2000"), null);
    assert.equal(existsSync(path.join(root, ".agent/dev-tab.json")), false);
    writeState(root, state);
    assert.equal(liveState(root, () => null), null);
    assert.equal(readState(root), null);
    // 自分のプロセスの印は読める(Linux / ps)
    assert.ok(procStartOf(process.pid));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("pickPort: 使われていない最初のポートを返し、全部使われていれば null", async () => {
  const used = new Set([3000, 3001]);
  assert.equal(await pickPort(async (p) => used.has(p), 3000, 5), 3002);
  assert.equal(await pickPort(async () => true, 3000, 3), null);
});

test("detectPackageManager: ロックファイルで決め、無ければ pnpm", () => {
  assert.equal(detectPackageManager(["pnpm-lock.yaml"]), "pnpm");
  assert.equal(detectPackageManager(["yarn.lock"]), "yarn");
  assert.equal(detectPackageManager(["bun.lock"]), "bun");
  assert.equal(detectPackageManager(["package-lock.json"]), "npm");
  assert.equal(detectPackageManager([]), "pnpm");
});

test("buildDevCommand: PORT と APP_BASE_URL を合わせ、next dev には --port も渡す", () => {
  assert.equal(
    buildDevCommand("pnpm", "next dev", 3001),
    "PORT=3001 APP_BASE_URL=http://localhost:3001 pnpm dev --port 3001",
  );
  assert.equal(
    buildDevCommand("npm", "next dev --turbo", 3002),
    "PORT=3002 APP_BASE_URL=http://localhost:3002 npm run dev -- --port 3002",
  );
  assert.equal(buildDevCommand("pnpm", "vite", 3003), "PORT=3003 APP_BASE_URL=http://localhost:3003 pnpm dev");
});

test("DEV_COMMAND_PATTERN: pnpm dev 等は当たり、pnpm workflow dev-tab run 自身や dev:xxx は当たらない", () => {
  for (const command of ["pnpm dev", "pnpm dev --port 3001", "npm run dev", "yarn dev", "next dev --port 3001", "next-server (v16.1.1)"]) {
    assert.equal(DEV_COMMAND_PATTERN.test(command), true, command);
  }
  for (const command of [
    "node /usr/bin/pnpm workflow dev-tab run",
    "/bin/bash -c source snapshot.sh && pnpm workflow dev-tab run",
    "pnpm workflow dev-tab run stop",
    "npm run dev:setup",
  ]) {
    assert.equal(DEV_COMMAND_PATTERN.test(command), false, command);
  }
});

test("ancestorPids: 自分から親へたどり、輪になっていても止まる", () => {
  assert.deepEqual(ancestorPids(30, new Map([[30, 20], [20, 10], [10, 1], [1, 0]])), [30, 20, 10, 1]);
  assert.deepEqual(ancestorPids(5, new Map([[5, 6], [6, 5]])), [5, 6]);
  assert.equal(ancestorPids(process.pid).includes(process.pid), true);
});

test("isUnder: 同じフォルダと下のフォルダだけ", () => {
  assert.equal(isUnder("/a/b", "/a/b"), true);
  assert.equal(isUnder("/a/b/c", "/a/b"), true);
  assert.equal(isUnder("/a/bc", "/a/b"), false);
  assert.equal(isUnder("/a", "/a/b"), false);
});

test("socketFromTmuxEnv / sessionSlug", () => {
  assert.equal(socketFromTmuxEnv("/tmp/tmux-1000/default,123,0"), "/tmp/tmux-1000/default");
  assert.equal(socketFromTmuxEnv(undefined), null);
  assert.equal(sessionSlug("next-starter.wt-feature/x"), "next-starter-wt-feature-x");
});

const socketName = `devtab-test-${process.pid}`;
let dir: string | null = null;

// このファイルの tmux はすべて一時フォルダの socket を使う(子プロセスにも引き継ぐ)。
// tmux は kill-server の後も socket のファイルを残すことがあるので、フォルダごと消して /tmp/tmux-<uid>/ に溜めない
// この一時フォルダには tmux-<uid>/ がまだ無いので、--socket=<名前> がその親のフォルダを作れること(作らないと tmux -S が
// 黙って何もしない)も通しのテストで確かめている
const tmuxTmp = realpathSync(mkdtempSync(path.join(tmpdir(), "devtab-sock-")));
process.env.TMUX_TMPDIR = tmuxTmp;

after(() => {
  spawnSync("tmux", ["-L", socketName, "kill-server"], { stdio: "ignore" });
  if (dir) rmSync(dir, { recursive: true, force: true });
  rmSync(tmuxTmp, { recursive: true, force: true });
});

test("通し: tmux の外から立てる → もう一度は立てない → status → stop", { skip: !hasTmux() && "tmux が無い" }, async () => {
  dir = realpathSync(mkdtempSync(path.join(tmpdir(), "devtab-test-")));
  writeFileSync(
    path.join(dir, "server.js"),
    'require("http").createServer((q, s) => s.end(process.env.APP_BASE_URL)).listen(Number(process.env.PORT));\n',
  );
  writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "devtab-test", private: true, scripts: { dev: "node server.js" } }),
  );
  writeFileSync(path.join(dir, "package-lock.json"), "{}\n");

  const runner = path.join(import.meta.dirname, "run.ts");
  const tsx = path.resolve(import.meta.dirname, "../../../node_modules/.bin/tsx");
  const env: NodeJS.ProcessEnv = { ...process.env, AGENT_TERMINAL: "tmux", DEV_TAB_WAIT: "20" };
  delete env.INIT_CWD;
  delete env.TMUX;
  delete env.TMUX_PANE;
  const run = (...args: string[]) =>
    spawnSync(tsx, [runner, ...args, ...(args[0] === "stop" || args[0] === "status" ? [] : [`--socket=${socketName}`])], {
      cwd: dir as string,
      env,
      encoding: "utf8",
    });

  const first = run();
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /開発サーバーを立てました: http:\/\/localhost:\d+/);
  const state = readState(dir);
  assert.ok(state);
  assert.equal(await isPortAnswering(state.port), true);
  const body = await fetch(`http://localhost:${state.port}/`).then((r) => r.text());
  assert.equal(body, `http://localhost:${state.port}`);

  const again = run();
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /もう動いています/);

  const status = run("status");
  assert.match(status.stdout, /応答あり/);

  const stopped = run("stop");
  assert.equal(stopped.status, 0, stopped.stderr);
  assert.match(stopped.stdout, /開発サーバーを止めました/);
  assert.equal(existsSync(path.join(dir, ".agent/dev-tab.json")), false);
  assert.equal(await isPortAnswering(state.port), false);
});

test("通し: tmux の中から呼ぶと、今のセッションにタブ Dev を足す", { skip: !hasTmux() && "tmux が無い" }, async () => {
  const host = realpathSync(mkdtempSync(path.join(tmpdir(), "devtab-test-in-")));
  writeFileSync(
    path.join(host, "server.js"),
    'require("http").createServer((q, s) => s.end("ok")).listen(Number(process.env.PORT));\n',
  );
  writeFileSync(path.join(host, "package.json"), JSON.stringify({ name: "devtab-in", private: true, scripts: { dev: "node server.js" } }));
  writeFileSync(path.join(host, "package-lock.json"), "{}\n");
  const tmuxOut = (...args: string[]) =>
    spawnSync("tmux", ["-L", socketName, ...args], { encoding: "utf8" }).stdout.trim();
  spawnSync("tmux", ["-L", socketName, "new-session", "-d", "-s", "host", "-c", host], { stdio: "ignore" });
  const [socketPath, paneId] = tmuxOut("display-message", "-p", "-t", "host", "#{socket_path}\t#{pane_id}").split("\t");

  const tsx = path.resolve(import.meta.dirname, "../../../node_modules/.bin/tsx");
  const runner = path.join(import.meta.dirname, "run.ts");
  const env: NodeJS.ProcessEnv = { ...process.env, AGENT_TERMINAL: "tmux", DEV_TAB_WAIT: "20", TMUX: `${socketPath},1,0`, TMUX_PANE: paneId };
  delete env.INIT_CWD;
  const run = (...args: string[]) => spawnSync(tsx, [runner, ...args], { cwd: host, env, encoding: "utf8" });
  try {
    const started = run();
    assert.equal(started.status, 0, started.stderr);
    assert.match(started.stdout, /セッション host/);
    assert.match(tmuxOut("list-windows", "-t", "host", "-F", "#{window_name}"), /Dev/);
    const stopped = run("stop");
    assert.equal(stopped.status, 0, stopped.stderr);
    assert.doesNotMatch(tmuxOut("list-windows", "-t", "host", "-F", "#{window_name}"), /Dev/);
  } finally {
    rmSync(host, { recursive: true, force: true });
  }
});

/** 裏の通し用の小さなリポ(dev = node server.js) */
const makeServerRepo = (prefix: string): string => {
  const repo = realpathSync(mkdtempSync(path.join(tmpdir(), prefix)));
  writeFileSync(
    path.join(repo, "server.js"),
    'require("http").createServer((q, s) => s.end(process.env.APP_BASE_URL)).listen(Number(process.env.PORT));\n',
  );
  writeFileSync(path.join(repo, "package.json"), JSON.stringify({ name: "devtab-bg", private: true, scripts: { dev: "node server.js" } }));
  writeFileSync(path.join(repo, "package-lock.json"), "{}\n");
  return repo;
};

const bgRepos: string[] = [];
after(() => {
  for (const repo of bgRepos) {
    const state = readState(repo);
    if (state && state.mode === "background") {
      try {
        process.kill(-state.pgid, "SIGKILL");
      } catch {
        // もう終わっている
      }
    }
    rmSync(repo, { recursive: true, force: true });
  }
});

const runIn = (repo: string, env: NodeJS.ProcessEnv, ...args: string[]) =>
  spawnSync(path.resolve(import.meta.dirname, "../../../node_modules/.bin/tsx"), [path.join(import.meta.dirname, "run.ts"), ...args], {
    cwd: repo,
    env,
    encoding: "utf8",
  });

test("通し(裏): AGENT_TERMINAL=none → 裏で立てる → もう一度は立てない → status → stop(グループもポートも残らない)", async () => {
  const repo = makeServerRepo("devtab-bg-");
  bgRepos.push(repo);
  const env: NodeJS.ProcessEnv = { ...process.env, AGENT_TERMINAL: "none", DEV_TAB_WAIT: "20" };
  delete env.INIT_CWD;
  const first = runIn(repo, env);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /開発サーバーを立てました: http:\/\/localhost:\d+ — .*、裏のプロセス \d+\(ログ \.agent\/dev-tab\.log\)/);
  const state = readState(repo);
  assert.ok(state && state.mode === "background");
  assert.equal(state.pgid, state.pid);
  assert.equal(await isPortAnswering(state.port), true);
  assert.equal(await fetch(`http://localhost:${state.port}/`).then((r) => r.text()), `http://localhost:${state.port}`);
  assert.ok(existsSync(path.join(repo, ".agent/dev-tab.log")));

  const again = runIn(repo, env);
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /もう動いています/);
  assert.equal(readState(repo)?.mode === "background" && (readState(repo) as DevTabBackgroundState).pid, state.pid);

  assert.match(runIn(repo, env, "status").stdout, /裏のプロセス \d+.*応答あり/);

  const stopped = runIn(repo, env, "stop");
  assert.equal(stopped.status, 0, stopped.stderr);
  assert.match(stopped.stdout, /開発サーバーを止めました/);
  assert.equal(existsSync(path.join(repo, ".agent/dev-tab.json")), false);
  assert.equal(isGroupAlive(state.pgid), false);
  assert.equal(await isPortAnswering(state.port), false);
  assert.match(runIn(repo, env, "status").stdout, /動いている開発サーバーはありません/);
});

test("通し(裏): AGENT_TERMINAL=tmux でも --background なら裏。--background と --session は誤り(exit 1)", async () => {
  const repo = makeServerRepo("devtab-bg2-");
  bgRepos.push(repo);
  const env: NodeJS.ProcessEnv = { ...process.env, AGENT_TERMINAL: "tmux", DEV_TAB_WAIT: "20" };
  delete env.INIT_CWD;
  const bad = runIn(repo, env, "--background", "--session=s1");
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /一緒に使えません/);
  const first = runIn(repo, env, "--background");
  assert.equal(first.status, 0, first.stderr);
  const state = readState(repo);
  assert.ok(state && state.mode === "background");
  const stopped = runIn(repo, env, "stop");
  assert.equal(stopped.status, 0, stopped.stderr);
  assert.equal(isGroupAlive(state.pgid), false);
});

test("通し(裏): 応答する前に終わる dev は失敗(exit 1)で、記録を残さずログの終わりを見せる", () => {
  const repo = realpathSync(mkdtempSync(path.join(tmpdir(), "devtab-bg3-")));
  bgRepos.push(repo);
  writeFileSync(path.join(repo, "package.json"), JSON.stringify({ name: "devtab-bg3", private: true, scripts: { dev: "node -e \"console.log('boom'); process.exit(4)\"" } }));
  writeFileSync(path.join(repo, "package-lock.json"), "{}\n");
  const env: NodeJS.ProcessEnv = { ...process.env, AGENT_TERMINAL: "none", DEV_TAB_WAIT: "20" };
  delete env.INIT_CWD;
  const r = runIn(repo, env);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /起動の途中で終わりました[\s\S]*boom/);
  assert.equal(existsSync(path.join(repo, ".agent/dev-tab.json")), false);
});
