// scripts/dev-tab/lib.ts
//
// pnpm dev:tab の共通処理。開発サーバーを tmux のタブ(window)で動かし、止め、様子を出す。
// - tmux の中から呼ぶと、今の tmux セッションにタブ「Dev」を足す($TMUX の socket に従うので、どの tmux サーバーでも同じ)
// - tmux の外から呼ぶと、裏で tmux セッション dev-<フォルダ名> を作ってそこで動かす
// - 記録は 1 チェックアウトに 1 つ(<チェックアウト>/.agent/dev-tab.json)。ワークツリーごとに別になる
// 規則と使い方: scripts/dev-tab/README.md

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

export const WINDOW_NAME = "Dev";
export const STATE_FILE = ".agent/dev-tab.json";
export const LAUNCH_FILE = ".agent/dev-tab-launch.sh";
export const DEFAULT_FIRST_PORT = 3000;
export const DEFAULT_PORT_TRIES = 20;

/** 開発サーバーとみなすコマンドの形(外で動いているものの検出に使う) */
export const DEV_COMMAND_PATTERN =
  /next dev|next-server|next\/dist\/bin\/next|vite|nuxt dev|astro dev|remix dev|webpack serve|(pnpm|npm|yarn|bun)( run)? dev/;

export type DevTabState = {
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
export const isTabAlive = (state: DevTabState): boolean =>
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

/** 生きている記録(タブが消えていれば記録を消して null) */
export const liveState = (root: string): DevTabState | null => {
  const state = readState(root);
  if (!state) return null;
  if (isTabAlive(state)) return state;
  removeState(root);
  return null;
};

export type DevProcess = { pid: number; command: string };

/** dir(とその下)を作業場所にしている開発サーバーのプロセス。Linux は /proc、それ以外は ps + lsof */
export const findDevProcesses = (dir: string): DevProcess[] => {
  const target = path.resolve(dir);
  const found: DevProcess[] = [];
  if (existsSync("/proc/self/cwd")) {
    for (const entry of readdirSync("/proc")) {
      if (!/^\d+$/.test(entry)) continue;
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
    if (!match || !DEV_COMMAND_PATTERN.test(match[2])) continue;
    const lsof = spawnSync("lsof", ["-a", "-p", match[1], "-d", "cwd", "-Fn"], { encoding: "utf8" });
    const cwd = (lsof.stdout ?? "").split("\n").find((l) => l.startsWith("n"))?.slice(1);
    if (cwd && isUnder(cwd, target)) found.push({ pid: Number(match[1]), command: match[2].slice(0, 120) });
  }
  return found;
};

/** pid とその子孫すべて(親 → 子の順) */
export const processTree = (rootPid: number): number[] => {
  const children = new Map<number, number[]>();
  const ps = spawnSync("ps", ["-axo", "pid=,ppid="], { encoding: "utf8" });
  for (const line of (ps.stdout ?? "").split("\n")) {
    const [pid, ppid] = line.trim().split(/\s+/).map(Number);
    if (!pid || Number.isNaN(ppid)) continue;
    children.set(ppid, [...(children.get(ppid) ?? []), pid]);
  }
  const result: number[] = [];
  const queue = [rootPid];
  while (queue.length > 0) {
    const pid = queue.shift() as number;
    result.push(pid);
    queue.push(...(children.get(pid) ?? []));
  }
  return result;
};

/** 1 行の案内: 「http://localhost:<port> — <どこ>、タブ <番号>(セッション <名前>)」 */
export const describeState = (state: DevTabState): string =>
  `http://localhost:${state.port} — ${describeCheckout(state.dir)}、タブ ${state.windowIndex}(セッション ${state.session})`;
