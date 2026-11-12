// scripts/workflow/devcheck/lib.exec.ts
//
// run / cleanup の本体。外に触る物(コマンドを打つ・ファイル・待つ・数える)は Deps で受け、テストは偽の Deps で動かす。
// 規則と使い方: scripts/workflow/devcheck/README.md

import { DevcheckError, type Context, type Item, type Policy } from "./lib";
import {
  EMPTY_RECORD,
  ENV_ADD_FILE,
  EXIT_POLICY,
  EXIT_WAIT,
  addRows,
  appendEnv,
  checkStatement,
  cleanupSteps,
  dbQueryArgv,
  deleteSql,
  devTabStarted,
  parseJsonRows,
  policyRefusal,
  resolveRunTarget,
  serverArgv,
  waitForSlot,
  type DevcheckRecord,
  type Runner,
} from "./lib.run";

export type Deps = {
  root: string;
  context: Context;
  policy: Policy;
  items: Item[];
  runner: Runner;
  readRecord: () => DevcheckRecord | null;
  writeRecord: (record: DevcheckRecord) => void;
  removeRecord: () => void;
  readEnvFile: () => string;
  writeEnvFile: (text: string) => void;
  readStdin: () => string;
  countLiveServers: () => number;
  sleep: (ms: number) => Promise<void>;
  waitSec: number;
  out: (line: string) => void;
};

/** 終了コードと、出した行 */
export type ExecResult = { code: number };

const passThrough = (deps: Deps, result: { code: number; stdout: string; stderr: string }): ExecResult => {
  if (result.stdout.trim()) deps.out(result.stdout.trimEnd());
  if (result.stderr.trim()) deps.out(result.stderr.trimEnd());
  return { code: result.code };
};

/** run <名前> [引数…] [--manual-go]: 候補 1 つを実行する */
export const execRun = async (args: string[], deps: Deps): Promise<ExecResult> => {
  const manualGo = args.includes("--manual-go");
  const [name, ...rest] = args.filter((a) => a !== "--manual-go");
  if (!name) throw new DevcheckError("run <候補の名前> [引数…](候補は pnpm workflow devcheck plan)");
  const target = resolveRunTarget(name, deps.items);
  const refusal = policyRefusal(deps.policy[target.kind], manualGo, name);
  if (refusal) {
    deps.out(refusal);
    return { code: EXIT_POLICY };
  }
  const record = deps.readRecord() ?? EMPTY_RECORD;

  if (target.item) {
    if (rest.length > 0) throw new DevcheckError(`${name}: fork の項目は引数を取らない(項目のファイルのコマンドのまま打つ)`);
    return passThrough(deps, deps.runner(target.item.command.split(/\s+/)));
  }

  switch (target.kind) {
    case "server": {
      const ok = await waitForSlot(deps.context.devMax, deps.countLiveServers, deps.sleep, deps.waitSec);
      if (!ok) {
        deps.out(`server: 動いている開発サーバーが上限 ${deps.context.devMax} のまま ${deps.waitSec} 秒たった(立てていない、exit ${EXIT_WAIT})`);
        return { code: EXIT_WAIT };
      }
      const result = deps.runner(serverArgv(deps.context));
      if (devTabStarted(result)) deps.writeRecord({ ...record, startedServer: true });
      return passThrough(deps, result);
    }
    case "login":
      return passThrough(deps, deps.runner(["pnpm", "-s", "workflow", "dev-admin", "run"]));
    case "test":
    case "check":
      return passThrough(deps, deps.runner(["pnpm", target.kind, ...rest]));
    case "db-write":
    case "db-delete": {
      const sql = rest.join(" ");
      const statement = checkStatement(target.kind, sql);
      const result = deps.runner(dbQueryArgv(sql));
      if (result.code !== 0) return passThrough(deps, result);
      if (statement.kind === "db-write") {
        const ids = parseJsonRows(result.stdout).map((row) => String(row[statement.column]));
        deps.writeRecord(addRows(record, { table: statement.table, column: statement.column, ids }));
        deps.out(`db-write: ${statement.table} に ${ids.length} 行(${statement.column}: ${ids.join(", ")})。片付けで消す`);
      } else deps.out(`db-delete: ${statement.table} の行を消した(${parseJsonRows(result.stdout).length} 行を返した)`);
      return { code: 0 };
    }
    case "env-add": {
      const [key] = rest;
      if (!key || rest.length > 1) throw new DevcheckError("env-add <鍵>(値は標準入力から。表示しない)");
      const value = deps.readStdin().replace(/\r?\n$/, "");
      deps.writeEnvFile(appendEnv(deps.readEnvFile(), key, value));
      deps.out(`env-add: ${key} を ${ENV_ADD_FILE} に足しました(値は表示しない)`);
      return { code: 0 };
    }
    default:
      throw new DevcheckError(`${name}: run の対象ではない`);
  }
};

/** cleanup: この命令が作った行を消し、立てたサーバーを止め、記録を消す */
export const execCleanup = (deps: Deps): ExecResult => {
  const record = deps.readRecord();
  if (!record || cleanupSteps(record).length === 0) {
    deps.removeRecord();
    deps.out("片付けるものなし(この命令が立てたサーバー・作った行は無い)");
    deps.out("画面から作った行はこの命令では分からない(残した行は報告に書く)");
    return { code: 0 };
  }
  let failed = false;
  const left: DevcheckRecord = { ...record, rows: [] };
  for (const step of cleanupSteps(record)) {
    if (step.type === "delete") {
      const result = deps.runner(dbQueryArgv(deleteSql(step.set.table, step.set.column, step.set.ids)));
      if (result.code === 0) deps.out(`消した: ${step.set.table} の ${step.set.ids.length} 行(${step.set.column}: ${step.set.ids.join(", ")})`);
      else {
        failed = true;
        left.rows.push(step.set);
        deps.out(`消せなかった: ${step.set.table}(${result.stderr.trim().split("\n").at(-1) ?? ""})`);
      }
    } else {
      const result = deps.runner(["pnpm", "-s", "workflow", "dev-tab", "run", "stop"]);
      if (result.code === 0) {
        left.startedServer = false;
        deps.out(result.stdout.trim() || "サーバーを止めた");
      } else {
        failed = true;
        deps.out(`サーバーを止められなかった: ${result.stderr.trim()}`);
      }
    }
  }
  if (failed) deps.writeRecord(left);
  else deps.removeRecord();
  deps.out("画面から作った行はこの命令では分からない(残した行は報告に書く)");
  return { code: failed ? 1 : 0 };
};
