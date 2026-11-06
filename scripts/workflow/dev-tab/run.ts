// scripts/workflow/dev-tab/run.ts
//
// pnpm workflow dev-tab run [start] [--port=<n>] [--session=<name>] [--socket=<name>]
// pnpm workflow dev-tab run stop
// pnpm workflow dev-tab run status
//
// 終了コード: 0 = できた(既に動いていた場合も)/ 1 = 失敗 / 2 = tmux が無い / 3 = 立てなかった(この道具の外で動いているサーバーがある)
// 規則と使い方: scripts/workflow/dev-tab/README.md

import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import {
  LAUNCH_FILE,
  WINDOW_NAME,
  buildDevCommand,
  checkoutRoot,
  describeCheckout,
  describeState,
  detectPackageManager,
  findDevProcesses,
  hasTmux,
  invocationDir,
  isPortAnswering,
  isPortBound,
  liveState,
  pickPort,
  processTree,
  removeState,
  sessionSlug,
  sleep,
  socketFromTmuxEnv,
  tmux,
  tmuxTry,
  writeState,
  type DevTabState,
} from "./lib";

const USAGE =
  "使い方: pnpm workflow dev-tab run [start] [--port=<n>] [--session=<name>] [--socket=<name>] | pnpm workflow dev-tab run stop | pnpm workflow dev-tab run status";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    port: { type: "string" },
    session: { type: "string" },
    socket: { type: "string" },
  },
});

const sub = positionals[0] ?? "start";
if (positionals.length > 1 || !["start", "stop", "status"].includes(sub)) {
  console.error(USAGE);
  process.exit(1);
}

const root = checkoutRoot(invocationDir());

const fail = (message: string, code = 1): never => {
  console.error(message);
  process.exit(code);
};


/** --socket=<name>(tmux -L <name>)を socket のパスに直す。tmux サーバーがまだ無くても決まる */
const socketPathOf = (name: string): string => {
  const base = process.env.TMUX_TMPDIR || "/tmp";
  const dir = path.join(base, `tmux-${process.getuid?.() ?? 0}`);
  // tmux -S <path> は親のフォルダが無いと何も作らず、エラーも出さずに終わる(tmux -L なら tmux 自身が作る)。
  // tmux を一度も使っていないマシンや、別の TMUX_TMPDIR でも動くよう、tmux と同じ権限 700 で先に作る
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return path.join(dir, name);
};

const start = async () => {
  if (!hasTmux()) {
    fail(
      "dev:tab: tmux がありません。入れてからもう一度(Debian/Ubuntu/WSL: sudo apt install tmux、macOS: brew install tmux)",
      2,
    );
  }

  const running = liveState(root);
  if (running) {
    console.log(`開発サーバーはもう動いています: ${describeState(running)}`);
    return;
  }

  const packageJson = path.join(root, "package.json");
  if (!existsSync(packageJson)) fail(`dev:tab: ${root} に package.json がありません`);
  const devScript: string | undefined = JSON.parse(readFileSync(packageJson, "utf8")).scripts?.dev;
  if (!devScript) fail(`dev:tab: ${root} の package.json に dev スクリプトがありません`);

  const outside = findDevProcesses(root);
  if (outside.length > 0) {
    console.error(
      `dev:tab: ${describeCheckout(root)} ではこの道具の外で開発サーバーが動いています(立てません。そのまま使うか、止めてからもう一度):`,
    );
    for (const proc of outside.slice(0, 3)) console.error(`  ${proc.pid} ${proc.command}`);
    process.exit(3);
  }

  const lock = path.join(root, ".next/dev/lock");
  if (existsSync(lock)) {
    rmSync(lock, { force: true });
    console.log("(前回の残り .next/dev/lock を消しました)");
  }

  let port: number;
  if (values.port) {
    if (!/^\d+$/.test(values.port)) fail(`dev:tab: --port は数字: ${values.port}`);
    port = Number(values.port);
    if (await isPortBound(port)) fail(`dev:tab: ポート ${port} は使われています(--port を外せば空きを選びます)`);
  } else {
    const tries = Number(process.env.DEV_TAB_PORTS ?? 20);
    const picked = await pickPort(isPortBound, 3000, tries);
    if (picked === null) fail(`dev:tab: 3000〜${3000 + tries - 1} に空いているポートがありません(--port=<n> で指定)`);
    port = picked as number;
  }

  const command = buildDevCommand(detectPackageManager(readdirSync(root)), devScript as string, port);
  const launch = path.join(root, LAUNCH_FILE);
  mkdirSync(path.dirname(launch), { recursive: true });
  const quoted = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
  writeFileSync(
    launch,
    [
      "#!/usr/bin/env bash",
      "# pnpm workflow dev-tab run が書いた起動スクリプト(scripts/workflow/dev-tab)。止めるのは pnpm workflow dev-tab run stop",
      `cd ${quoted(root)} || exit 1`,
      `printf '開発サーバー: %s\\n  http://localhost:%s\\n  %s\\n\\n' ${quoted(describeCheckout(root))} ${port} ${quoted(command)}`,
      command,
      "rc=$?",
      `printf '\\n開発サーバーが止まりました(終了コード %s)。このタブは pnpm workflow dev-tab run stop で閉じます。\\n' "$rc"`,
      "exec bash",
      "",
    ].join("\n"),
  );

  // どの tmux サーバーの、どのセッションに足すか
  const socket = values.socket ? socketPathOf(values.socket) : socketFromTmuxEnv(process.env.TMUX);
  let session = values.session ?? null;
  if (!session && socket && !values.socket && process.env.TMUX_PANE) {
    session = tmuxTry(socket, ["display-message", "-p", "-t", process.env.TMUX_PANE, "#{session_name}"]);
  }
  const format = "#{socket_path}\t#{session_name}\t#{window_id}\t#{window_index}";
  const shell = `bash ${quoted(launch)}`;
  let created: string;
  try {
    if (session && tmuxTry(socket, ["has-session", "-t", session]) !== null) {
      created = tmux(socket, ["new-window", "-d", "-P", "-F", format, "-t", `${session}:`, "-n", WINDOW_NAME, "-c", root, shell]);
    } else {
      // tmux の外(または指定のセッションが無い): 裏でセッションを作る
      session = session ?? `dev-${sessionSlug(path.basename(root))}`;
      if (tmuxTry(socket, ["has-session", "-t", session]) !== null) {
        created = tmux(socket, ["new-window", "-d", "-P", "-F", format, "-t", `${session}:`, "-n", WINDOW_NAME, "-c", root, shell]);
      } else {
        created = tmux(socket, ["new-session", "-d", "-P", "-F", format, "-s", session, "-n", WINDOW_NAME, "-c", root, shell]);
      }
    }
  } catch (error) {
    fail(`dev:tab: tmux のタブを開けませんでした: ${(error as Error).message}`);
    return;
  }
  const [socketPath, sessionName, windowId, windowIndex] = created.split("\t");
  if (!socketPath || !sessionName || !windowId || !windowIndex) {
    fail(`dev:tab: tmux がタブの情報を返しませんでした(socket: ${socket ?? "既定"})。タブは開いていない可能性があります`);
  }
  const state: DevTabState = {
    dir: root,
    port,
    socket: socketPath,
    session: sessionName,
    windowId,
    windowIndex,
    command,
    startedAt: new Date().toISOString(),
  };
  writeState(root, state);
  tmuxTry(socketPath, ["set-option", "-w", "-t", windowId, "automatic-rename", "off"]);

  const wait = Number(process.env.DEV_TAB_WAIT ?? 60);
  let up = false;
  for (let t = 0; t < wait && !up; t += 1) {
    up = await isPortAnswering(port);
    if (!up) await sleep(1000);
  }
  const attachHint = process.env.TMUX ? "" : `\n  見るとき: tmux ${values.socket ? `-L ${values.socket} ` : ""}attach -t ${sessionName}`;
  if (up) console.log(`開発サーバーを立てました: ${describeState(state)}${attachHint}`);
  else console.log(`開発サーバーを起動中です(${wait} 秒で応答なし。タブを見てください): ${describeState(state)}${attachHint}`);
};

const stop = async () => {
  const state = liveState(root);
  if (!state) {
    console.log(`${describeCheckout(root)} に pnpm workflow dev-tab run の開発サーバーは動いていません`);
    return;
  }
  const line = describeState(state);
  const panePid = Number(tmuxTry(state.socket, ["display-message", "-p", "-t", state.windowId, "#{pane_pid}"]));
  tmuxTry(state.socket, ["send-keys", "-t", state.windowId, "C-c"]);
  const wait = Number(process.env.DEV_TAB_STOP_WAIT ?? 10);
  for (let t = 0; t < wait && (await isPortAnswering(state.port)); t += 1) await sleep(1000);
  if (panePid) {
    for (const pid of processTree(panePid).slice(1)) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // もう終わっている
      }
    }
  }
  tmuxTry(state.socket, ["kill-window", "-t", state.windowId]);
  if (findDevProcesses(root).length === 0) rmSync(path.join(root, ".next/dev/lock"), { force: true });
  removeState(root);
  console.log(`開発サーバーを止めました: ${line}`);
};

const status = async () => {
  const state = liveState(root);
  if (state) {
    const answering = await isPortAnswering(state.port);
    console.log(`${describeState(state)}(${answering ? "応答あり" : "応答なし・タブを見る"})`);
    return;
  }
  const outside = findDevProcesses(root);
  if (outside.length > 0) {
    console.log(`${describeCheckout(root)}: pnpm workflow dev-tab run の開発サーバーはありません。この道具の外で動いているもの:`);
    for (const proc of outside.slice(0, 3)) console.log(`  ${proc.pid} ${proc.command}`);
    return;
  }
  console.log(`${describeCheckout(root)}: 動いている開発サーバーはありません`);
};

const main = async () => {
  if (sub === "stop") await stop();
  else if (sub === "status") await status();
  else await start();
};

main().catch((error) => fail(`dev:tab: ${(error as Error).message}`));
