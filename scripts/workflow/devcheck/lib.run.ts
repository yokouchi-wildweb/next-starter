// scripts/workflow/devcheck/lib.run.ts
//
// pnpm workflow devcheck run / cleanup の部品。打つコマンドは Runner に渡す(テストは偽の Runner で、打つはずのコマンドを見る)。
// - 1 回に候補 1 つ。方針: off = 断る(手で)、manual = --manual-go の時だけ、auto = 実行
// - この命令の記録 <checkout>/.agent/devcheck.json = 立てたサーバー・作った DB の行。片付け(cleanup)はこれだけを止めて消す
// - DB に書くのは guard を通る入口(pnpm ops db inspect query --json、--env は付けない)だけ。1 文の INSERT … RETURNING / DELETE … WHERE に限る
// - env-add は .env.development だけに足し、値は表示しない
// 規則と使い方: scripts/workflow/devcheck/README.md

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { DevcheckError, KIND_NAMES, serverCommand, type Context, type Item, type KindName, type Policy, type PolicyValue } from "./lib";

/** 打つコマンド 1 つの結果 */
export type RunResult = { code: number; stdout: string; stderr: string };
/** コマンドを打つ物(シェルを通さない)。input = 標準入力に渡す文字列 */
export type Runner = (argv: string[], options?: { input?: string }) => RunResult;

/** 方針で止める時の終了コード(使い方の誤り 1・待ちきれない 3 と分ける) */
export const EXIT_POLICY = 4;
export const EXIT_WAIT = 3;

// ---- 何を実行するか -------------------------------------------------------------------------

export type Target = { name: string; kind: KindName; source: "upstream" | "fork"; item: Item | null };

/** run の名前を種類か fork の項目に引く。browser は命令ではない(エージェントの Playwright)、cleanup は別の動作 */
export const resolveRunTarget = (name: string, items: Item[]): Target => {
  if (name === "browser") throw new DevcheckError("browser は命令ではなくエージェントが Playwright で行う(run の対象ではない)");
  if (name === "cleanup") throw new DevcheckError("片付けは pnpm workflow devcheck cleanup");
  if ((KIND_NAMES as string[]).includes(name)) return { name, kind: name as KindName, source: "upstream", item: null };
  const item = items.find((i) => i.name === name);
  if (item) return { name, kind: item.kind, source: "fork", item };
  throw new DevcheckError(`知らない候補 ${name}(pnpm workflow devcheck plan の候補の名前)`);
};

/** 方針で通すか: off = 手で(この命令はしない)、manual = 別の go の印 --manual-go が要る。通らなければ理由 */
export const policyRefusal = (policy: PolicyValue, manualGo: boolean, name: string): string | null => {
  if (policy === "off") return `${name}: 方針で off — この命令はしない(手で)`;
  if (policy === "manual" && !manualGo) return `${name}: 方針で manual — この項目だけ別に go を取ってから --manual-go を付ける`;
  return null;
};

// ---- DB の 1 文 -------------------------------------------------------------------------------

const IDENT = /^"?([A-Za-z_][A-Za-z0-9_]*)"?$/;

export type Statement = { kind: "db-write"; table: string; column: string } | { kind: "db-delete"; table: string };

/**
 * db-write は 1 文の INSERT INTO <表> … RETURNING <列>、db-delete は 1 文の DELETE FROM <表> WHERE …。
 * それ以外(DDL・UPDATE・複数の文・WHERE の無い DELETE・RETURNING の無い INSERT・スキーマつきの表)は断る
 */
export const checkStatement = (kind: "db-write" | "db-delete", sql: string): Statement => {
  const text = sql.trim().replace(/;\s*$/, "");
  if (text.includes(";")) throw new DevcheckError(`${kind}: 1 文だけ(; で文をつながない)`);
  if (kind === "db-write") {
    const m = /^INSERT\s+INTO\s+("?[A-Za-z_][A-Za-z0-9_]*"?)\s[\s\S]*\bRETURNING\s+("?[A-Za-z_][A-Za-z0-9_]*"?)\s*$/i.exec(text);
    if (!m) throw new DevcheckError("db-write: INSERT INTO <表> … RETURNING <列> の 1 文だけ(作った行を片付けで消すため RETURNING が要る)");
    return { kind, table: (IDENT.exec(m[1]) as RegExpExecArray)[1], column: (IDENT.exec(m[2]) as RegExpExecArray)[1] };
  }
  const m = /^DELETE\s+FROM\s+("?[A-Za-z_][A-Za-z0-9_]*"?)\s+WHERE\s+\S[\s\S]*$/i.exec(text);
  if (!m) throw new DevcheckError("db-delete: DELETE FROM <表> WHERE … の 1 文だけ(WHERE の無い削除は断る)");
  return { kind, table: (IDENT.exec(m[1]) as RegExpExecArray)[1] };
};

/** 片付けで消す 1 文(id は文字列の値として渡す: Postgres が列の型に合わせる) */
export const deleteSql = (table: string, column: string, ids: string[]): string =>
  `DELETE FROM "${table}" WHERE "${column}" IN (${ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(", ")})`;

/** DB の入口(guard を通る。--env は付けない = 開発、本番は人の確認が要る) */
export const dbQueryArgv = (sql: string): string[] => ["pnpm", "-s", "ops", "db", "inspect", "query", sql, "--json"];

/** --json の出力の最後の行を行の配列として読む */
export const parseJsonRows = (stdout: string): Record<string, unknown>[] => {
  const line = stdout.trim().split("\n").filter(Boolean).at(-1) ?? "";
  try {
    const rows = JSON.parse(line);
    if (Array.isArray(rows)) return rows;
  } catch {
    // 下で止める
  }
  throw new DevcheckError("DB の入口の答えが JSON の配列でない");
};

// ---- この命令の記録 ----------------------------------------------------------------------------

export const RECORD_FILE = ".agent/devcheck.json";
export type RowSet = { table: string; column: string; ids: string[] };
export type DevcheckRecord = { v: 1; startedServer: boolean; rows: RowSet[] };
export const EMPTY_RECORD: DevcheckRecord = { v: 1, startedServer: false, rows: [] };

export const readRecord = (root: string): DevcheckRecord | null => {
  const file = path.join(root, RECORD_FILE);
  if (!existsSync(file)) return null;
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    return data?.v === 1 && Array.isArray(data.rows) ? (data as DevcheckRecord) : null;
  } catch {
    return null;
  }
};

export const writeRecord = (root: string, record: DevcheckRecord): void => {
  mkdirSync(path.join(root, ".agent"), { recursive: true });
  writeFileSync(path.join(root, RECORD_FILE), `${JSON.stringify(record, null, 2)}\n`);
};

export const removeRecord = (root: string): void => rmSync(path.join(root, RECORD_FILE), { force: true });

/** 作った行を記録に足す(同じ表と列なら id をまとめる) */
export const addRows = (record: DevcheckRecord, rows: RowSet): DevcheckRecord => {
  const same = record.rows.find((r) => r.table === rows.table && r.column === rows.column);
  if (same) return { ...record, rows: record.rows.map((r) => (r === same ? { ...r, ids: [...new Set([...r.ids, ...rows.ids])] } : r)) };
  return { ...record, rows: [...record.rows, rows] };
};

// ---- サーバー ---------------------------------------------------------------------------------

/** dev-tab の答えから「この命令が立てた」か(もう動いていた・外のサーバー・失敗は立てていない) */
export const devTabStarted = (result: RunResult): boolean => result.code === 0 && /開発サーバーを(立てました|起動中です)/.test(result.stdout);

/**
 * 上限まで待つ: 生きている dev-tab の数が dev_max 未満になるまで pollSec ごとに数え直し、waitSec を過ぎたら false。
 * 上限が無ければすぐ true
 */
export const waitForSlot = async (
  devMax: number | null,
  count: () => number,
  sleep: (ms: number) => Promise<void>,
  waitSec: number,
  pollSec = 5,
): Promise<boolean> => {
  if (devMax === null) return true;
  for (let waited = 0; ; waited += pollSec) {
    if (count() < devMax) return true;
    if (waited >= waitSec) return false;
    await sleep(pollSec * 1000);
  }
};

/** サーバーの種類の打つコマンド(argv) */
export const serverArgv = (context: Context): string[] => ["pnpm", "-s", ...serverCommand(context.server).split(" ").slice(1)];

// ---- env-add ----------------------------------------------------------------------------------

export const ENV_ADD_FILE = ".env.development";

/** .env.development の中身に KEY=値 を足した中身(鍵の形が違う・もうある鍵は断る) */
export const appendEnv = (text: string, key: string, value: string): string => {
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) throw new DevcheckError(`env-add: 鍵 ${key} は英大文字・数字・_ (先頭は英大文字)`);
  if (/[\r\n]/.test(value)) throw new DevcheckError("env-add: 値は 1 行");
  if (new RegExp(`^\\s*(export\\s+)?${key}\\s*=`, "m").test(text)) throw new DevcheckError(`env-add: ${key} はもう ${ENV_ADD_FILE} にある(書き換えない)`);
  const body = text === "" || text.endsWith("\n") ? text : `${text}\n`;
  return `${body}${key}=${value}\n`;
};

// ---- 片付け -------------------------------------------------------------------------------------

export type CleanupStep = { type: "stop-server" } | { type: "delete"; set: RowSet };

/** 記録から片付けの手順(行を消してからサーバーを止める) */
export const cleanupSteps = (record: DevcheckRecord): CleanupStep[] => [
  ...record.rows.filter((r) => r.ids.length > 0).map((set) => ({ type: "delete" as const, set })),
  ...(record.startedServer ? [{ type: "stop-server" as const }] : []),
];

/** policy の型を外に出す(run.ts で使う) */
export type { Policy };
