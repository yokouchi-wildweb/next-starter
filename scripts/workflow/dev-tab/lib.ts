// scripts/workflow/dev-tab/lib.ts
//
// pnpm workflow dev-tab run の共通処理。開発サーバーを tmux のタブ(window)か裏のプロセスで動かし、止め、様子を出す。
// - どこで動かすか = decideMode: --background・AGENT_TERMINAL=none・tmux が無い → 裏のプロセス(切り離したプロセスグループ、
//   ログ .agent/dev-tab.log)。--session / --socket(tmux の行き先の名指し)・AGENT_TERMINAL=tmux → タブ
// - タブ: tmux の中から呼ぶと、今の tmux セッションにタブ「Dev」を足す($TMUX の socket に従うので、どの tmux サーバーでも同じ)。
//   tmux の外から呼ぶと、裏で tmux セッション dev-<フォルダ名> を作ってそこで動かす
// - 記録は 1 チェックアウトに 1 つ(<チェックアウト>/.agent/dev-tab.json)。ワークツリーごとに別になる
// 規則と使い方: scripts/workflow/dev-tab/README.md

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

export const WINDOW_NAME = "Dev";
export const STATE_FILE = ".agent/dev-tab.json";
export const LAUNCH_FILE = ".agent/dev-tab-launch.sh";
export const LOG_FILE = ".agent/dev-tab.log";
export const DEFAULT_FIRST_PORT = 3000;
export const DEFAULT_PORT_TRIES = 20;

/**
 * 開発サーバーとみなすコマンドの形(外で動いているものの検出に使う)。
 * `pnpm dev` 等は dev の直後が空白か行末のときだけ当てる(`pnpm workflow dev-tab run` 自身や `dev:xxx` を外のサーバーと見誤らないため)。
 */
export const DEV_COMMAND_PATTERN =
  /next dev|next-server|next\/dist\/bin\/next|vite|nuxt dev|astro dev|remix dev|webpack serve|(pnpm|npm|yarn|bun)( run)? dev(\s|$)/;

/** タブで動かした記録(mode の無い古い記録もこれ) */
export type DevTabTabState = {
  mode?: "tab";
  dir: string;
  port: number;
  /** tmux の socket のパス(どの tmux サーバーか) */
  socket: string;
  session: string;
  /** tmux の window id(@N)。番号と違い、ほかのタブが閉じても変わらない */
  windowId: string;
  windowIndex: string;
  command: string;
  startedAt: string;
};

/** 裏のプロセスで動かした記録。pid の使い回しで別のプロセスを止めないよう、開始時刻の印 procStart も持つ */
export type DevTabBackgroundState = {
  mode: "background";
  dir: string;
  port: number;
  pid: number;
  /** プロセスグループ(切り離して立てたので pid と同じ)。止めるときはグループごと */
  pgid: number;
  procStart: string;
  /** ログのパス(チェックアウトからの相対) */
  log: string;
  command: string;
  startedAt: string;
};

export type DevTabState = DevTabTabState | DevTabBackgroundState;

export const isBackground = (state: DevTabState): state is DevTabBackgroundState => state.mode === "background";

export type DevTabMode = "tab" | "background";

/**
 * どこで動かすか。--background と tmux の行き先の名指し(--session / --socket)は両立しない(null = 使い方の誤り)。
 * 名指しは AGENT_TERMINAL より強い(チームツールは名指しで呼ぶ)。AGENT_TERMINAL=tmux でも tmux が無ければ裏
 */
export const decideMode = (opts: {
  background: boolean;
  session: string | null;
  socket: string | null;
  terminal: string;
  hasTmux: boolean;
}): DevTabMode | null => {
  const named = Boolean(opts.session || opts.socket);
  if (opts.background) return named ? null : "background";
  if (named) return "tab";
  return opts.terminal === "tmux" && opts.hasTmux ? "tab" : "background";
};

// ---- 純粋な部品(テスト対象) ------------------------------------------------------------

/** isUsed が false を返す最初のポート。tries 個すべて使われていれば null */
export const pickPort = async (
  isUsed: (port: number) => Promise<boolean>,
  first = DEFAULT_FIRST_PORT,
  tries = DEFAULT_PORT_TRIES,
): Promise<number | null> => {
  for (let port = first; port < first + tries; port += 1) {
    if (!(await isUsed(port))) return port;
  }
  return null;
};

/** ロックファイルからパッケージマネージャーを決める(無ければ pnpm) */
export const detectPackageManager = (files: string[]): "pnpm" | "yarn" | "bun" | "npm" => {
  if (files.includes("pnpm-lock.yaml")) return "pnpm";
  if (files.includes("yarn.lock")) return "yarn";
  if (files.includes("bun.lockb") || files.includes("bun.lock")) return "bun";
  if (files.includes("package-lock.json")) return "npm";
  return "pnpm";
};

/**
 * dev スクリプトを動かすコマンド行。PORT と APP_BASE_URL をそのポートに合わせる
 * (APP_BASE_URL を合わせないと、3000 以外で立てたときメールのリンク等が 3000 を指す。プロセスの env は .env.* より優先される)。
 * `next dev` には --port も渡す(next は PORT も読むが、明示しておく)。
 */
export const buildDevCommand = (pm: string, devScript: string, port: number): string => {
  const env = `PORT=${port} APP_BASE_URL=http://localhost:${port}`;
  const extra = /^next dev\b/.test(devScript.trim()) ? `--port ${port}` : "";
  if (pm === "npm") return `${env} npm run dev${extra ? ` -- ${extra}` : ""}`;
  return `${env} ${pm} dev${extra ? ` ${extra}` : ""}`;
};

/** child が parent そのものか、その下にあるか */
export const isUnder = (child: string, parent: string): boolean => {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
};

/** $TMUX("<socket>,<pid>,<session>")から socket のパス */
export const socketFromTmuxEnv = (value: string | undefined): string | null => {
  if (!value) return null;
  const socket = value.split(",")[0];
  return socket ? socket : null;
};

/** tmux のセッション名に使える形にする(. と : は tmux が区切りに使う) */
export const sessionSlug = (name: string): string => name.replace(/[^A-Za-z0-9_-]+/g, "-");

// ---- 環境に触る部品 ---------------------------------------------------------------------

/** pnpm run は package.json の場所で実行されるため、呼び出し元のディレクトリは INIT_CWD から取る */
export const invocationDir = (): string => process.env.INIT_CWD ?? process.cwd();

/** dir を含むチェックアウト(ワークツリー)のルート。git の外なら dir のまま */
export const checkoutRoot = (dir: string): string => {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return path.resolve(dir);
  }
};

/** 「ワークツリー <名前>(ブランチ <b>)」「本体のチェックアウト <名前>(ブランチ <b>)」、git の外ならフォルダ */
export const describeCheckout = (dir: string): string => {
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  try {
    const gitDir = git(["rev-parse", "--path-format=absolute", "--git-dir"]);
    const common = git(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
    const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
    const kind = gitDir === common ? "本体のチェックアウト" : "ワークツリー";
    return `${kind} ${path.basename(dir)}(ブランチ ${branch})`;
  } catch {
    return dir;
  }
};

/** そのポートを今だれかが待ち受けているか(bind できるかで見る。開く前の空き探し専用: 起動待ちの最中には使わない) */
export const isPortBound = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => server.close(() => resolve(false)));
    server.listen(port);
  });

/**
 * そのポートが応答するか(TCP で 1 秒だけつないでみる)。
 * 1 秒で打ち切るのは、WSL2 の networkingMode=mirrored で閉じたポートへの接続が拒否されずに待ち続けるため。
 */
export const isPortAnswering = (port: number, timeoutMs = 1000): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = net.connect({ port, host: "localhost" });
    const done = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const hasTmux = (): boolean => spawnSync("tmux", ["-V"], { stdio: "ignore" }).status === 0;

/** socket を決めた tmux の呼び出し。失敗は例外 */
export const tmux = (socket: string | null, args: string[]): string => {
  const full = socket ? ["-S", socket, ...args] : args;
  return execFileSync("tmux", full, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
};

/** 失敗しても止まらない tmux の呼び出し(null = 失敗) */
export const tmuxTry = (socket: string | null, args: string[]): string | null => {
  try {
    return tmux(socket, args);
  } catch {
    return null;
  }
};

/** 記録のタブがまだあるか(window id で引き、名前が Dev のままか) */
export const isTabAlive = (state: DevTabTabState): boolean =>
  tmuxTry(state.socket, ["display-message", "-p", "-t", state.windowId, "#{window_name}"]) === WINDOW_NAME;

export const readState = (root: string): DevTabState | null => {
  const file = path.join(root, STATE_FILE);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as DevTabState;
  } catch {
    return null;
  }
};

export const writeState = (root: string, state: DevTabState): void => {
  mkdirSync(path.join(root, ".agent"), { recursive: true });
  writeFileSync(path.join(root, STATE_FILE), `${JSON.stringify(state, null, 2)}\n`);
};

export const removeState = (root: string): void => {
  rmSync(path.join(root, STATE_FILE), { force: true });
};

/**
 * プロセスの開始時刻の印(pid の使い回しを見分ける)。Linux は /proc/<pid>/stat の starttime、ほかは ps の lstart。
 * プロセスが無ければ null
 */
export const procStartOf = (pid: number): string | null => {
  if (existsSync("/proc/self/stat")) {
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
      // comm は空白や括弧を含みうるので、最後の ')' の後から数える(starttime = 22 番目の欄)
      const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      return fields[19] ?? null;
    } catch {
      return null;
    }
  }
  const ps = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8" });
  const out = (ps.stdout ?? "").trim();
  return ps.status === 0 && out ? out : null;
};

/** 裏のプロセスがまだ同じもので生きているか(pid があり、開始時刻の印が記録と同じ) */
export const isBackgroundAlive = (state: DevTabBackgroundState, startOf: (pid: number) => string | null = procStartOf): boolean =>
  startOf(state.pid) === state.procStart;

/** 生きている記録(タブが消えた・裏のプロセスが終わった・pid が別のプロセスになっていれば記録を消して null) */
export const liveState = (root: string, startOf: (pid: number) => string | null = procStartOf): DevTabState | null => {
  const state = readState(root);
  if (!state) return null;
  if (isBackground(state) ? isBackgroundAlive(state, startOf) : isTabAlive(state)) return state;
  removeState(root);
  return null;
};

/** プロセスグループがまだあるか(シグナル 0 を送れるか) */
export const isGroupAlive = (pgid: number): boolean => {
  try {
    process.kill(-pgid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

const signalGroup = (pgid: number, signal: NodeJS.Signals): void => {
  try {
    process.kill(-pgid, signal);
  } catch {
    // もう終わっている
  }
};

/**
 * 裏のプロセスグループを止める: SIGINT(Ctrl-C と同じ)→ ポートが閉じるまで最大 waitSec 秒 → 残っていれば SIGTERM →
 * 最大 2 秒 → まだ残っていれば SIGKILL。グループが残らなければ true
 */
export const stopGroup = async (pgid: number, port: number, waitSec: number): Promise<boolean> => {
  signalGroup(pgid, "SIGINT");
  for (let t = 0; t < waitSec && isGroupAlive(pgid) && (await isPortAnswering(port)); t += 1) await sleep(1000);
  if (isGroupAlive(pgid)) {
    signalGroup(pgid, "SIGTERM");
    for (let t = 0; t < 20 && isGroupAlive(pgid); t += 1) await sleep(100);
  }
  if (isGroupAlive(pgid)) {
    signalGroup(pgid, "SIGKILL");
    for (let t = 0; t < 20 && isGroupAlive(pgid); t += 1) await sleep(100);
  }
  return !isGroupAlive(pgid);
};

export type DevProcess = { pid: number; command: string };

/** ps から pid → ppid の対応 */
const readParents = (): Map<number, number> => {
  const parents = new Map<number, number>();
  const ps = spawnSync("ps", ["-axo", "pid=,ppid="], { encoding: "utf8" });
  for (const line of (ps.stdout ?? "").split("\n")) {
    const [pid, ppid] = line.trim().split(/\s+/).map(Number);
    if (!pid || Number.isNaN(ppid)) continue;
    parents.set(pid, ppid);
  }
  return parents;
};

/** pid とその祖先すべて(自分 → 親 → … の順) */
export const ancestorPids = (pid: number, parents: Map<number, number> = readParents()): number[] => {
  const result: number[] = [];
  let current: number | undefined = pid;
  while (current && !result.includes(current)) {
    result.push(current);
    current = parents.get(current);
  }
  return result;
};

/**
 * dir(とその下)を作業場所にしている開発サーバーのプロセス。Linux は /proc、それ以外は ps + lsof。
 * この道具自身とその祖先(pnpm workflow dev-tab run を呼んだシェル等)は除く。
 */
export const findDevProcesses = (dir: string): DevProcess[] => {
  const target = path.resolve(dir);
  const self = new Set(ancestorPids(process.pid));
  const found: DevProcess[] = [];
  if (existsSync("/proc/self/cwd")) {
    for (const entry of readdirSync("/proc")) {
      if (!/^\d+$/.test(entry) || self.has(Number(entry))) continue;
      try {
        const cwd = readlinkSync(`/proc/${entry}/cwd`);
        if (!isUnder(cwd, target)) continue;
        const command = readFileSync(`/proc/${entry}/cmdline`, "utf8").replace(/\0/g, " ").trim();
        if (DEV_COMMAND_PATTERN.test(command)) found.push({ pid: Number(entry), command: command.slice(0, 120) });
      } catch {
        // 読めないプロセス(他人のもの・もう終わったもの)は見ない
      }
    }
    return found;
  }
  const ps = spawnSync("ps", ["-axo", "pid=,command="], { encoding: "utf8" });
  for (const line of (ps.stdout ?? "").split("\n")) {
    const match = line.trim().match(/^(\d+)\s+(.*)$/);
    if (!match || self.has(Number(match[1])) || !DEV_COMMAND_PATTERN.test(match[2])) continue;
    const lsof = spawnSync("lsof", ["-a", "-p", match[1], "-d", "cwd", "-Fn"], { encoding: "utf8" });
    const cwd = (lsof.stdout ?? "").split("\n").find((l) => l.startsWith("n"))?.slice(1);
    if (cwd && isUnder(cwd, target)) found.push({ pid: Number(match[1]), command: match[2].slice(0, 120) });
  }
  return found;
};

/** pid とその子孫すべて(親 → 子の順) */
export const processTree = (rootPid: number): number[] => {
  const children = new Map<number, number[]>();
  for (const [pid, ppid] of readParents()) children.set(ppid, [...(children.get(ppid) ?? []), pid]);
  const result: number[] = [];
  const queue = [rootPid];
  while (queue.length > 0) {
    const pid = queue.shift() as number;
    result.push(pid);
    queue.push(...(children.get(pid) ?? []));
  }
  return result;
};

/**
 * 1 行の案内: タブ 「http://localhost:<port> — <どこ>、タブ <番号>(セッション <名前>)」 /
 * 裏 「http://localhost:<port> — <どこ>、裏のプロセス <pid>(ログ <log>)」
 */
export const describeState = (state: DevTabState): string =>
  isBackground(state)
    ? `http://localhost:${state.port} — ${describeCheckout(state.dir)}、裏のプロセス ${state.pid}(ログ ${state.log})`
    : `http://localhost:${state.port} — ${describeCheckout(state.dir)}、タブ ${state.windowIndex}(セッション ${state.session})`;
