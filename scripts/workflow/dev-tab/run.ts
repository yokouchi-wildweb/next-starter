// scripts/workflow/dev-tab/run.ts
//
// pnpm workflow dev-tab run [start] [--port=<n>] [--background | --session=<name> | --socket=<name>]
// pnpm workflow dev-tab run stop
// pnpm workflow dev-tab run status
//
// どこで動かすか: lib.ts decideMode(--background・AGENT_TERMINAL=none・tmux が無い → 裏のプロセス、ほかはタブ)
// 終了コード: 0 = できた(既に動いていた場合も)/ 1 = 失敗 / 3 = 立てなかった(この道具の外で動いているサーバーがある)
// 規則と使い方: scripts/workflow/dev-tab/README.md

import { spawn } from "node:child_process";
import { closeSync, existsSync, openSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { readAgentTerminal } from "../agent-terminal/lib.mjs";
import {
  LAUNCH_FILE,
  LOG_FILE,
  WINDOW_NAME,
  buildDevCommand,
  checkoutRoot,
  decideMode,
  describeCheckout,
  describeState,
  detectPackageManager,
  findDevProcesses,
  hasTmux,
  invocationDir,
  isPortAnswering,
  isBackground,
  isGroupAlive,
  isPortBound,
  liveState,
  pickPort,
  procStartOf,
  processTree,
  removeState,
  sessionSlug,
  sleep,
  socketFromTmuxEnv,
  stopGroup,
  tmux,
  tmuxTry,
  writeState,
  type DevTabBackgroundState,
  type DevTabTabState,
} from "./lib";

const USAGE =
  "使い方: pnpm workflow dev-tab run [start] [--port=<n>] [--background | --session=<name> | --socket=<name>] | pnpm workflow dev-tab run stop | pnpm workflow dev-tab run status";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    port: { type: "string" },
    background: { type: "boolean" },
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
  const mode = decideMode({
    background: Boolean(values.background),
    session: values.session ?? null,
    socket: values.socket ?? null,
    terminal: String(readAgentTerminal(process.env)),
    hasTmux: hasTmux(),
  });
  if (mode === null) fail(`pnpm workflow dev-tab run: --background と --session / --socket は一緒に使えません\n${USAGE}`);

  const running = liveState(root);
  if (running) {
    console.log(`開発サーバーはもう動いています: ${describeState(running)}`);
    return;
  }

  const packageJson = path.join(root, "package.json");
  if (!existsSync(packageJson)) fail(`pnpm workflow dev-tab run: ${root} に package.json がありません`);
  const devScript: string | undefined = JSON.parse(readFileSync(packageJson, "utf8")).scripts?.dev;
  if (!devScript) fail(`pnpm workflow dev-tab run: ${root} の package.json に dev スクリプトがありません`);

  const outside = findDevProcesses(root);
  if (outside.length > 0) {
    console.error(
      `pnpm workflow dev-tab run: ${describeCheckout(root)} ではこの道具の外で開発サーバーが動いています(立てません。そのまま使うか、止めてからもう一度):`,
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
    if (!/^\d+$/.test(values.port)) fail(`pnpm workflow dev-tab run: --port は数字: ${values.port}`);
    port = Number(values.port);
    if (await isPortBound(port)) fail(`pnpm workflow dev-tab run: ポート ${port} は使われています(--port を外せば空きを選びます)`);
  } else {
    const tries = Number(process.env.DEV_TAB_PORTS ?? 20);
    const picked = await pickPort(isPortBound, 3000, tries);
    if (picked === null) fail(`pnpm workflow dev-tab run: 3000〜${3000 + tries - 1} に空いているポートがありません(--port=<n> で指定)`);
    port = picked as number;
  }

  const command = buildDevCommand(detectPackageManager(readdirSync(root)), devScript as string, port);
  const launch = path.join(root, LAUNCH_FILE);
  mkdirSync(path.dirname(launch), { recursive: true });
  const quoted = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
  if (mode === "background") {
    await startBackground(port, command, launch, quoted);
    return;
  }
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
    fail(`pnpm workflow dev-tab run: tmux のタブを開けませんでした: ${(error as Error).message}`);
    return;
  }
  const [socketPath, sessionName, windowId, windowIndex] = created.split("\t");
  if (!socketPath || !sessionName || !windowId || !windowIndex) {
    fail(`pnpm workflow dev-tab run: tmux がタブの情報を返しませんでした(socket: ${socket ?? "既定"})。タブは開いていない可能性があります`);
  }
  const state: DevTabTabState = {
    mode: "tab",
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

/** 裏のプロセスで立てる: 切り離したプロセスグループで起動スクリプトを動かし、出力はログへ。記録を書いて起動を待つ */
const startBackground = async (port: number, command: string, launch: string, quoted: (s: string) => string) => {
  writeFileSync(
    launch,
    [
      "#!/usr/bin/env bash",
      "# pnpm workflow dev-tab run が書いた起動スクリプト(裏のプロセス、scripts/workflow/dev-tab)。止めるのは pnpm workflow dev-tab run stop",
      `cd ${quoted(root)} || exit 1`,
      `printf '開発サーバー(裏のプロセス): %s\\n  http://localhost:%s\\n  %s\\n\\n' ${quoted(describeCheckout(root))} ${port} ${quoted(command)}`,
      command,
      "rc=$?",
      `printf '\\n開発サーバーが止まりました(終了コード %s)\\n' "$rc"`,
      "exit $rc",
      "",
    ].join("\n"),
  );
  const logPath = path.join(root, LOG_FILE);
  const out = openSync(logPath, "w");
  let pid: number | undefined;
  try {
    // detached = 新しいセッション・プロセスグループ(pgid = pid)。この道具が終わっても動き続け、止めるときはグループごと
    const child = spawn("bash", [launch], { cwd: root, detached: true, stdio: ["ignore", out, out], env: process.env });
    pid = child.pid;
    child.unref();
  } finally {
    closeSync(out);
  }
  const procStart = pid ? procStartOf(pid) : null;
  if (!pid || !procStart) fail(`pnpm workflow dev-tab run: 裏のプロセスを立てられませんでした(ログ: ${LOG_FILE})`);
  const state: DevTabBackgroundState = {
    mode: "background",
    dir: root,
    port,
    pid: pid as number,
    pgid: pid as number,
    procStart: procStart as string,
    log: LOG_FILE,
    command,
    startedAt: new Date().toISOString(),
  };
  writeState(root, state);

  const wait = Number(process.env.DEV_TAB_WAIT ?? 60);
  let up = false;
  for (let t = 0; t < wait && !up; t += 1) {
    up = await isPortAnswering(port);
    if (!up && !isGroupAlive(state.pgid)) {
      // 応答する前に終わった: 記録を消し、ログの終わりを見せて失敗にする
      removeState(root);
      const tail = existsSync(logPath) ? readFileSync(logPath, "utf8").trim().split("\n").slice(-5).join("\n") : "";
      fail(`pnpm workflow dev-tab run: 開発サーバーが起動の途中で終わりました(ログ ${LOG_FILE} の終わり):\n${tail}`);
    }
    if (!up) await sleep(1000);
  }
  if (up) console.log(`開発サーバーを立てました: ${describeState(state)}`);
  else console.log(`開発サーバーを起動中です(${wait} 秒で応答なし。ログを見てください): ${describeState(state)}`);
};

const stop = async () => {
  const state = liveState(root);
  if (!state) {
    console.log(`${describeCheckout(root)} に pnpm workflow dev-tab run の開発サーバーは動いていません`);
    return;
  }
  const line = describeState(state);
  if (isBackground(state)) {
    const gone = await stopGroup(state.pgid, state.port, Number(process.env.DEV_TAB_STOP_WAIT ?? 10));
    if (!gone) fail(`pnpm workflow dev-tab run: 裏のプロセスグループ ${state.pgid} が止まりませんでした(記録は残します): ${line}`);
    if (findDevProcesses(root).length === 0) rmSync(path.join(root, ".next/dev/lock"), { force: true });
    removeState(root);
    console.log(`開発サーバーを止めました: ${line}`);
    return;
  }
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
    console.log(`${describeState(state)}(${answering ? "応答あり" : isBackground(state) ? "応答なし・ログを見る" : "応答なし・タブを見る"})`);
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

main().catch((error) => fail(`pnpm workflow dev-tab run: ${(error as Error).message}`));
