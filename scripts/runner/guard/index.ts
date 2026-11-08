// scripts/runner/guard/index.ts
// DB・外部に書く入口すべてが通す共通の守り(D58・D84・D92)。読むだけの入口も向き先の選び方と印の確かめを通す(確認は無し)。
//
// 向き先: 既定は開発。--env <development|staging|production> で選ぶ(ENV_FILE を渡せばそのファイル。名前の段階は --env と一致すること)。
// 読むファイル = ENV_FILE ?? .env.<段階>(+ あれば .env.<段階>.local を上に重ねる、個人の上書き・秘密)。
// 止める: ファイルが無い / 段階の印 APP_ENV が無い・知らない値 / 印とファイル名の段階が違う / 本番と開発が同じ DB(host と DB 名)/
//   本番の DB に書くのに本番の DATABASE_URL が空(リリース前 = 未設定)。.env.production が無いことは本番を指した時だけ止める。
// ホストの env(本番ホストで env ファイルを置かず環境変数を直接渡す): ファイルが無く、環境変数の APP_ENV が向き先と同じ時だけ、その値で進む
//   (本番は --env production の明示と確認が要る。例 Vercel 以外のスケジューラ = pnpm task --due --env production --confirm=production)。
// 本番に書く: 手で打つ(TTY)なら「production」と打たせる。非対話(TTY なし・CI・エージェント)は --confirm=production が無ければ拒否。
// デプロイ(env ファイルを読まない)は confirmProduction だけを通す。
// 守りの旗(--env・--confirm)は process.argv から外して入口に渡す(--dry-run は入口の物なので残す)。
// 同期で動く(tsx の CJS で先頭から呼べるように。確認の入力は標準入力から 1 行を同期で読む)。README.md

import { closeSync, existsSync, openSync, readFileSync, readSync, writeSync } from "node:fs";
import path from "node:path";

import { parse } from "dotenv";

import { APP_ENVS, type AppEnv } from "../../../src/lib/appEnv";

export class GuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardError";
  }
}

export type GuardFlags = { env: AppEnv | null; confirm: string | null; dryRun: boolean; rest: string[] };

/** --env <段階> / --env=<段階> / --confirm=<段階> を読み、残りの引数を返す(--dry-run は残す) */
export function parseGuardFlags(argv: readonly string[]): GuardFlags {
  const rest: string[] = [];
  let env: string | null = null;
  let confirm: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--env") {
      env = argv[i + 1] ?? "";
      i += 1;
    } else if (arg.startsWith("--env=")) env = arg.slice("--env=".length);
    else if (arg.startsWith("--confirm=")) confirm = arg.slice("--confirm=".length);
    else rest.push(arg);
  }
  if (env !== null && !(APP_ENVS as readonly string[]).includes(env)) throw new GuardError(`--env ${env || "(空)"} は知らない段階です(${APP_ENVS.join(" / ")})`);
  return { env: env as AppEnv | null, confirm, dryRun: rest.includes("--dry-run"), rest };
}

/** ファイル名の段階(.env.development* / .env.staging* / .env.production*)。分からなければ null */
export function stageOfFileName(file: string): AppEnv | null {
  const m = /^\.env\.(development|staging|production)(?:\..+)?$/.exec(path.basename(file));
  return m ? (m[1] as AppEnv) : null;
}

/** 接続文字列の host / DB 名(資格情報は捨てる)。空・読めなければ null */
export function dbIdentity(url: string | undefined): string | null {
  if (!url || url.trim() === "") return null;
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return url.trim();
  }
}

export type GuardIO = {
  cwd: string;
  env: Record<string, string | undefined>;
  isTTY: boolean;
  readFile: (file: string) => string | null;
  /** 1 行を読む(TTY のときだけ呼ぶ) */
  prompt: (question: string) => string;
};

export type ResolveOptions = {
  /** 書く入口か(本番なら確認を求める)。読むだけなら false */
  write: boolean;
  /** DB に書くか(本番の DATABASE_URL が空なら止める) */
  db?: boolean;
  /** 何をするかの短い言葉(確認と止める文に出す) */
  what: string;
};

export type WriteTarget = { stage: AppEnv; envFile: string; dryRun: boolean; rest: string[]; values: Record<string, string> };

const readValues = (io: GuardIO, file: string): Record<string, string> | null => {
  const text = io.readFile(path.resolve(io.cwd, file));
  return text === null ? null : parse(text);
};

/** 本番に書く前の確認(--confirm=production か、TTY で production と打つ)。通らなければ GuardError */
export function confirmProduction(flags: Pick<GuardFlags, "confirm">, io: GuardIO, what: string): void {
  if (flags.confirm !== null && flags.confirm !== "production") throw new GuardError(`--confirm=${flags.confirm} は向き先(production)と違います`);
  if (flags.confirm === "production") return;
  if (!io.isTTY) {
    throw new GuardError(`${what}: 本番(production)に向いています。非対話では --confirm=production を付けた時だけ実行します(何もしていません)`);
  }
  const answer = io.prompt(`⚠ ${what}: 本番(production)に向いています。続けるなら production と打ってください: `).trim();
  if (answer !== "production") throw new GuardError(`${what}: 確認が取れなかったので止めました(何もしていません)`);
}

/** 向き先を決めて確かめる(ファイルは読むが process.env には入れない)。通らなければ GuardError */
export function resolveTarget(argv: readonly string[], options: ResolveOptions, io: GuardIO): WriteTarget {
  const flags = parseGuardFlags(argv);
  const explicitFile = io.env.ENV_FILE && io.env.ENV_FILE.trim() !== "" ? io.env.ENV_FILE : null;
  const fileStage = explicitFile ? stageOfFileName(explicitFile) : null;
  if (explicitFile && !fileStage) throw new GuardError(`ENV_FILE=${explicitFile} の名前から段階が分かりません(.env.development / .env.staging / .env.production …)`);
  if (explicitFile && flags.env && fileStage !== flags.env) throw new GuardError(`ENV_FILE=${explicitFile}(${fileStage})と --env ${flags.env} が違います`);
  const stage: AppEnv = flags.env ?? fileStage ?? "development";
  const envFile = explicitFile ?? `.env.${stage}`;

  const fromFile = readValues(io, envFile);
  const hostMode = fromFile === null && !explicitFile && io.env.APP_ENV === stage;
  const base: Record<string, string> | null = hostMode ? { APP_ENV: stage } : fromFile;
  if (base === null) {
    const hint = stage === "development" ? "pnpm ops setup env で作る" : `本番・ステージングを指す時だけ要る。pnpm ops setup env ${envFile} で作る`;
    throw new GuardError(`${envFile} がありません(${hint})`);
  }
  const marker = base.APP_ENV;
  if (!marker) throw new GuardError(`${envFile} に段階の印 APP_ENV がありません(APP_ENV=${stage} の 1 行を書く)`);
  if (!(APP_ENVS as readonly string[]).includes(marker)) throw new GuardError(`${envFile} の APP_ENV=${marker} は知らない段階です(${APP_ENVS.join(" / ")})`);
  if (marker !== stage) throw new GuardError(`${envFile} の段階の印 APP_ENV=${marker} がファイル名・向き先の ${stage} と違います`);

  const localFile = `${envFile}.local`;
  const local = explicitFile || hostMode ? null : readValues(io, localFile);
  if (local?.APP_ENV && local.APP_ENV !== stage) throw new GuardError(`${localFile} の APP_ENV=${local.APP_ENV} が ${stage} と違います`);
  const values: Record<string, string> = hostMode ? {} : { ...base, ...(local ?? {}) };
  const dbUrl = hostMode ? io.env.DATABASE_URL : values.DATABASE_URL;
  if (io.env.APP_ENV && io.env.APP_ENV !== stage) throw new GuardError(`環境変数 APP_ENV=${io.env.APP_ENV} が向き先の ${stage} と違います(シェルの APP_ENV を外す)`);

  if (stage === "production") {
    const prodDb = dbIdentity(dbUrl);
    if (options.db && prodDb === null) throw new GuardError(`${options.what}: 本番の DATABASE_URL が空です(リリース前 = 未設定。DB に書けません)`);
    const dev = readValues(io, ".env.development");
    const devDb = dbIdentity(dev?.DATABASE_URL);
    if (prodDb !== null && devDb !== null && prodDb === devDb) throw new GuardError(`本番と開発が同じ DB(${prodDb})を指しています。開発と本番は別の DB にする(Neon ならブランチ)`);
  }
  if (options.write && stage === "production") confirmProduction(flags, io, options.what);
  else if (flags.confirm !== null && flags.confirm !== stage) throw new GuardError(`--confirm=${flags.confirm} は向き先(${stage})と違います`);

  return { stage, envFile: hostMode ? "(ホストの env)" : envFile, dryRun: flags.dryRun, rest: flags.rest, values };
}

/** 標準入力から 1 行を同期で読む(TTY 用) */
function promptLineSync(question: string): string {
  writeSync(2, question);
  let fd = 0;
  let opened = false;
  try {
    fd = openSync("/dev/tty", "rs");
    opened = true;
  } catch {
    fd = 0;
  }
  const buf = Buffer.alloc(1);
  let line = "";
  try {
    while (readSync(fd, buf, 0, 1, null) === 1) {
      const ch = buf.toString("utf8");
      if (ch === "\n") break;
      line += ch;
    }
  } finally {
    if (opened) closeSync(fd);
  }
  return line.replace(/\r$/, "");
}

/** 本物の入出力 */
export const realIO = (): GuardIO => ({
  cwd: process.cwd(),
  env: process.env,
  isTTY: Boolean(process.stdin.isTTY && process.stderr.isTTY),
  readFile: (file) => (existsSync(file) ? readFileSync(file, "utf8") : null),
  prompt: promptLineSync,
});

/** process.argv(先頭 2 つの後)から守りの旗を外す */
function stripGuardFlags(): void {
  const { rest } = parseGuardFlags(process.argv.slice(2));
  process.argv.splice(2, process.argv.length - 2, ...rest);
}

const fail = (error: unknown): never => {
  if (error instanceof GuardError) {
    console.error(`✗ ${error.message}`);
    process.exit(1);
  }
  throw error;
};

/**
 * 入口の先頭で呼ぶ: 向き先を決めて確かめ、env ファイルの値を process.env に入れる(既にある値は上書きしない)。
 * 守りの旗を process.argv から外す。通らなければ理由を出して exit 1(何もしない)
 */
export function guardEntry(options: ResolveOptions): WriteTarget {
  try {
    const target = resolveTarget(process.argv.slice(2), options, realIO());
    for (const [key, value] of Object.entries(target.values)) if (process.env[key] === undefined) process.env[key] = value;
    if (!target.envFile.startsWith("(")) process.env.ENV_FILE = target.envFile;
    stripGuardFlags();
    return target;
  } catch (error) {
    return fail(error);
  }
}

/** デプロイの入口: 本番に出す時だけ確認(env ファイルは読まない)。守りの旗を外す */
export function guardDeploy(what: string, production: boolean): void {
  try {
    const flags = parseGuardFlags(process.argv.slice(2));
    if (production) confirmProduction(flags, realIO(), what);
    stripGuardFlags();
  } catch (error) {
    fail(error);
  }
}
