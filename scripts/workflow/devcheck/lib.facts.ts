// scripts/workflow/devcheck/lib.facts.ts
//
// plan / status / run / cleanup が共有する、環境に触る部品(事実を集める・本物の Deps)。純粋な部品は lib.ts・lib.run.ts、本体は lib.exec.ts
// 事実を集める側は読むだけ(記録を消さない・何も書かない。管理者は dev-admin run --check の読む入口)
// 規則と使い方: scripts/workflow/devcheck/README.md

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { checkoutRoot, describeState, invocationDir, isPortAnswering, readState, sleep } from "../dev-tab/lib";
import {
  DevcheckError,
  countLiveServers,
  isRecordAlive,
  loadContext,
  loadPolicy,
  applyAuto,
  parseAdminCheck,
  scanItems,
  worktreePaths,
  type AdminFact,
  type Context,
  type Item,
  type Plan,
  type Policy,
} from "./lib";
import type { Deps } from "./lib.exec";
import { ENV_ADD_FILE, readRecord, removeRecord, writeRecord, type Runner } from "./lib.run";

const HERE = import.meta.dirname;

export type Setup = { root: string; context: Context; policy: Policy; items: Item[]; rejected: Plan["rejected"] };

/** 方針・項目・文脈(呼ばれるたびに読む) */
export const loadSetup = async (): Promise<Setup> => {
  const root = checkoutRoot(invocationDir());
  const context = loadContext(process.env);
  const policy = applyAuto(await loadPolicy(root), context.auto);   // 文脈の上書き(v=2)を掛けた効いている方針
  const scripts: Record<string, string> = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).scripts ?? {};
  const { items, rejected } = scanItems(path.join(HERE, "items"), root, scripts);
  return { root, context, policy, items, rejected };
};

/**
 * リポの全部の作業場所で共有のロック(git の共有ディレクトリに mkdir)の中で fn を 1 回。取れなければ 10 秒まで待ち、
 * 取れなければ null。120 秒より古いロックは持ち主が落ちた物として外す
 */
export const withRepoLock = <T>(root: string, name: string, fn: () => T): T | null => {
  let common: string;
  try {
    common = path.resolve(root, execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd: root, encoding: "utf8" }).trim());
  } catch {
    return fn();   // git の外: 数えるだけ(作業場所は 1 つ)
  }
  const lock = path.join(common, name);
  const wait = new Int32Array(new SharedArrayBuffer(4));
  for (let i = 0; ; i++) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      try {
        if (Date.now() - statSync(lock).mtimeMs > 120_000) rmSync(lock, { recursive: true, force: true });
      } catch {
        // 消えた: もう一度取りに行く
      }
      if (i >= 100) return null;
      Atomics.wait(wait, 0, 0, 100);
    }
  }
  try {
    return fn();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
};

/** シェルを通さずに打つ(作業場所で。INIT_CWD は外す: pnpm の入口が作業場所を取り違えないように) */
export const realRunner =
  (root: string): Runner =>
  (argv, options) => {
    const env = { ...process.env };
    delete env.INIT_CWD;
    const r = spawnSync(argv[0], argv.slice(1), { cwd: root, env, encoding: "utf8", input: options?.input });
    return { code: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? (r.error ? String(r.error) : "") };
  };

/** 管理者の有無(dev-admin run --check、読むだけ) */
export const adminFact = (root: string): AdminFact => {
  const r = realRunner(root)(["pnpm", "-s", "workflow", "dev-admin", "run", "--check"]);
  return parseAdminCheck(r.code, r.stdout, r.stderr);
};

/** 方針・項目・文脈・状態を集める(計画の候補は lib.ts の buildPlan が組む) */
export const gatherFacts = async (): Promise<Omit<Plan, "candidates">> => {
  const { root, context, policy, items, rejected } = await loadSetup();
  const record = readState(root);
  const live = record !== null && isRecordAlive(record);
  const server = live ? { line: describeState(record), answering: await isPortAnswering(record.port) } : null;
  const liveServers = countLiveServers(worktreePaths(root));
  return { checkout: root, context, policy, items, rejected, state: { server, liveServers, admin: adminFact(root) } };
};

/** run / cleanup の本物の Deps */
export const realDeps = (setup: Setup): Deps => ({
  root: setup.root,
  context: setup.context,
  policy: setup.policy,
  items: setup.items,
  runner: realRunner(setup.root),
  readRecord: () => readRecord(setup.root),
  writeRecord: (record) => writeRecord(setup.root, record),
  removeRecord: () => removeRecord(setup.root),
  readEnvFile: () => {
    const file = path.join(setup.root, ENV_ADD_FILE);
    if (!existsSync(file)) throw new DevcheckError(`env-add: ${ENV_ADD_FILE} がない(pnpm ops setup env で作る)`);
    return readFileSync(file, "utf8");
  },
  writeEnvFile: (text) => writeFileSync(path.join(setup.root, ENV_ADD_FILE), text),
  readStdin: () => {
    try {
      return readFileSync(0, "utf8");
    } catch {
      return "";
    }
  },
  countLiveServers: () => countLiveServers(worktreePaths(setup.root)),
  withServerLock: (fn) => withRepoLock(setup.root, "devcheck-server.lock", fn),
  sleep: async (ms) => {
    await sleep(ms);
  },
  waitSec: Number(process.env.DEVCHECK_WAIT ?? 300),
  out: (line) => console.log(line),
});

/** 入口の共通の形: 決まった旗だけを読み、DevcheckError は 1 行で exit 2 */
export const runAction = (body: (args: string[]) => Promise<number | void>, allowed: (arg: string) => boolean = (a) => a === "--json"): void => {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => a.startsWith("--") && !allowed(a));
  if (unknown.length > 0) {
    console.error(`pnpm workflow devcheck: 知らない引数 ${unknown.join(" ")}`);
    process.exit(2);
  }
  body(args)
    .then((code) => process.exit(code ?? 0))
    .catch((error) => {
      if (error instanceof DevcheckError) {
        console.error(`✗ ${error.message}`);
        process.exit(2);
      }
      console.error(`pnpm workflow devcheck: ${(error as Error).message}`);
      process.exit(1);
    });
};
