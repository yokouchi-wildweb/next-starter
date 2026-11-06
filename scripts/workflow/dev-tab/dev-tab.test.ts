// scripts/workflow/dev-tab/dev-tab.test.ts
//
// 純粋な部品の単体テストと、tmux があるときだけ動く通しのテスト
// (専用の tmux サーバー -L devtab-test-<pid> の上で、小さな HTTP サーバーを dev スクリプトとして立てて止める)。

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
  detectPackageManager,
  hasTmux,
  isPortAnswering,
  isUnder,
  pickPort,
  readState,
  sessionSlug,
  socketFromTmuxEnv,
} from "./lib";

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

test("DEV_COMMAND_PATTERN: pnpm dev 等は当たり、pnpm dev:tab 自身や dev:xxx は当たらない", () => {
  for (const command of ["pnpm dev", "pnpm dev --port 3001", "npm run dev", "yarn dev", "next dev --port 3001", "next-server (v16.1.1)"]) {
    assert.equal(DEV_COMMAND_PATTERN.test(command), true, command);
  }
  for (const command of [
    "node /usr/bin/pnpm dev:tab",
    "/bin/bash -c source snapshot.sh && pnpm dev:tab",
    "pnpm dev:tab stop",
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
  const env: NodeJS.ProcessEnv = { ...process.env, DEV_TAB_WAIT: "20" };
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
  const env: NodeJS.ProcessEnv = { ...process.env, DEV_TAB_WAIT: "20", TMUX: `${socketPath},1,0`, TMUX_PANE: paneId };
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
