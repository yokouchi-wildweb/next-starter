// scripts/workflow/local-settings/lib.ts
//
// pnpm workflow local-settings の部品。手元の Claude Code の設定を整える。
// - 手元(<チェックアウト>/.claude/settings.local.json)は全面的に書き換える: 印(DEVCHECK_GRANT=on)・
//   enabledMcpjsonServers の playwright・本人が残すと選んだ deny の行だけ。allow・コマンド名・パスは書かない
// - 個人設定(~/.claude/settings.json)は消さない。--bypass(全部許可を選んだ人)の時だけ決まった 2 項目を書く
// - 書く前に控え(<チェックアウト>/.agent/、追跡の外)。managed とチームの道具の起動ごとの設定には触れない
// 規則と使い方: scripts/workflow/local-settings/README.md

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export class LocalSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalSettingsError";
  }
}

/** 許可の層の印(scripts/workflow/devcheck/lib.grant.mjs の GRANT_ENV と同じ値) */
export const GRANT_ENV = "DEVCHECK_GRANT";
export const GRANT_ON = "on";
export const MCP_SERVERS = ["playwright"];
/** 上流が昔配った deny の 3 行(既定で残す。消すかは本人が選ぶ) */
export const OLD_DENY = ["Bash(sudo:*)", "Bash(rm -rf /:*)", "Read(./.env)"];

export const LOCAL_FILE = ".claude/settings.local.json";
export const PROJECT_FILE = ".claude/settings.json";
export const BACKUP_DIR = ".agent";

type Json = Record<string, unknown>;

export type Paths = { root: string; local: string; project: string; user: string; managed: string[] };

/** このチェックアウトと、効く設定ファイルの場所 */
export const resolvePaths = (cwd = process.cwd(), home = os.homedir()): Paths => {
  let root: string;
  try {
    root = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    throw new LocalSettingsError("git のチェックアウトの中で動かす");
  }
  return {
    root,
    local: path.join(root, LOCAL_FILE),
    project: path.join(root, PROJECT_FILE),
    user: path.join(home, ".claude", "settings.json"),
    managed: ["/etc/claude-code/managed-settings.json", "/Library/Application Support/ClaudeCode/managed-settings.json"],
  };
};

/** JSON のオブジェクトを読む。無い = null、読めない・オブジェクトでない = LocalSettingsError(何も書かない) */
export const readSettings = (file: string): Json | null => {
  if (!existsSync(file)) return null;
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new LocalSettingsError(`${file} が JSON として読めない(${(error as Error).message})。直してからもう一度`);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new LocalSettingsError(`${file} が JSON のオブジェクトでない。直してからもう一度`);
  return data as Json;
};

const asObject = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export type Options = { grant: boolean; dropDeny: string[]; bypass: boolean };

export type UserChange = { key: string; before: unknown; after: unknown };

export type Plan = {
  localFile: string;
  current: Json | null;
  next: Json;
  /** 消える行(env の値は出さない) */
  vanishing: string[];
  /** 残す deny の行 */
  keptDeny: string[];
  userFile: string;
  /** --bypass の時の個人設定の変わる項目(変わらない項目は出さない) */
  userChanges: UserChange[];
};

/** 設定を 1 行ずつの形にする(比べて消える行を出すため)。env の値は伏せる */
export const flatten = (data: Json | null): string[] => {
  const out: string[] = [];
  const walk = (value: unknown, key: string) => {
    if (key.startsWith("env.")) {
      out.push(key === `env.${GRANT_ENV}` ? `${key} = ${JSON.stringify(value)}` : `${key} = (値は表示しない)`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) out.push(`${key} = []`);
      for (const v of value) out.push(`${key}[] = ${JSON.stringify(v)}`);
    } else if (value && typeof value === "object") {
      const entries = Object.entries(value as Json);
      if (entries.length === 0) out.push(`${key} = {}`);
      for (const [k, v] of entries) walk(v, key ? `${key}.${k}` : k);
    } else out.push(`${key} = ${JSON.stringify(value)}`);
  };
  if (data) walk(data, "");
  return out;
};

/** 新しい手元の中身(印・MCP の有効化・残す deny だけ) */
export const nextLocal = (current: Json | null, options: Options): { next: Json; keptDeny: string[] } => {
  const deny = asStrings(asObject(current?.permissions).deny);
  for (const rule of options.dropDeny) if (!deny.includes(rule)) throw new LocalSettingsError(`消す deny の行 ${JSON.stringify(rule)} は今の手元に無い(今ある行: ${deny.length ? deny.join(" / ") : "なし"})`);
  const keptDeny = deny.filter((rule) => !options.dropDeny.includes(rule));
  const next: Json = {};
  if (options.grant) next.env = { [GRANT_ENV]: GRANT_ON };
  next.enabledMcpjsonServers = [...MCP_SERVERS];
  if (keptDeny.length) next.permissions = { deny: keptDeny };
  return { next, keptDeny };
};

/** 全部許可の 2 項目(個人設定)。変わる項目だけ返す */
export const userChanges = (user: Json | null): UserChange[] => {
  const changes: UserChange[] = [];
  const mode = asObject(user?.permissions).defaultMode;
  if (mode !== "bypassPermissions") changes.push({ key: "permissions.defaultMode", before: mode ?? null, after: "bypassPermissions" });
  const skip = user?.skipDangerousModePermissionPrompt;
  if (skip !== true) changes.push({ key: "skipDangerousModePermissionPrompt", before: skip ?? null, after: true });
  return changes;
};

/** 計画(何も書かない) */
export const buildPlan = (paths: Paths, options: Options): Plan => {
  const current = readSettings(paths.local);
  const { next, keptDeny } = nextLocal(current, options);
  const after = new Set(flatten(next));
  return {
    localFile: paths.local,
    current,
    next,
    vanishing: flatten(current).filter((line) => !after.has(line)),
    keptDeny,
    userFile: paths.user,
    userChanges: options.bypass ? userChanges(readSettings(paths.user)) : [],
  };
};

export const formatPlan = (plan: Plan, options: Options): string => {
  const lines = [`手元の設定: ${plan.localFile}${plan.current ? "" : "(まだ無い)"}`];
  lines.push("消える行:", ...(plan.vanishing.length ? plan.vanishing.map((l) => `  - ${l}`) : ["  (なし)"]));
  lines.push("新しい中身:", ...JSON.stringify(plan.next, null, 2).split("\n").map((l) => `  ${l}`));
  const old = OLD_DENY.filter((r) => plan.keptDeny.includes(r));
  if (old.length) lines.push(`昔の deny の行(残す。消すなら --drop-deny=<行>): ${old.join(" / ")}`);
  if (!options.grant) lines.push(`印 ${GRANT_ENV} を書かない(--no-grant): 許可のフックは確認を省かない`);
  if (options.bypass) {
    lines.push(`個人設定: ${plan.userFile}(ほかの項目は変えない)`);
    lines.push(...(plan.userChanges.length ? plan.userChanges.map((c) => `  - ${c.key}: ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}`) : ["  (変わる項目なし)"]));
    lines.push("  defaultMode は次の起動から効く");
  }
  return lines.join("\n");
};

const stamp = (now: Date) => now.toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-");

export type Applied = { localFile: string; localBackup: string | null; userFile: string | null; userBackup: string | null };

/** 計画のとおりに書く: 控え → 手元の全面書き換え →(--bypass)個人設定の 2 項目 */
export const applyPlan = (paths: Paths, options: Options, now = new Date()): Applied => {
  const plan = buildPlan(paths, options);
  const user = options.bypass ? readSettings(paths.user) : null;
  const backupDir = path.join(paths.root, BACKUP_DIR);
  mkdirSync(backupDir, { recursive: true });
  const t = stamp(now);
  let localBackup: string | null = null;
  if (plan.current) {
    localBackup = path.join(backupDir, `settings.local.${t}.json`);
    writeFileSync(localBackup, readFileSync(paths.local));
  }
  let userBackup: string | null = null;
  if (options.bypass && user && plan.userChanges.length) {
    userBackup = path.join(backupDir, `claude-user-settings.${t}.json`);
    writeFileSync(userBackup, readFileSync(paths.user));
  }
  mkdirSync(path.dirname(paths.local), { recursive: true });
  writeFileSync(paths.local, `${JSON.stringify(plan.next, null, 2)}\n`);
  let userFile: string | null = null;
  if (options.bypass && plan.userChanges.length) {
    const nextUser: Json = { ...(user ?? {}) };
    nextUser.permissions = { ...asObject(nextUser.permissions), defaultMode: "bypassPermissions" };
    nextUser.skipDangerousModePermissionPrompt = true;
    mkdirSync(path.dirname(paths.user), { recursive: true });
    writeFileSync(paths.user, `${JSON.stringify(nextUser, null, 2)}\n`);
    userFile = paths.user;
  }
  return { localFile: paths.local, localBackup, userFile, userBackup };
};

// ---- 今効いている設定 -----------------------------------------------------------------------------

export type Layer = { scope: "managed" | "user" | "project" | "local"; file: string; present: boolean; decides: string[] };

/** 1 つの設定ファイルが決めていること(短く) */
export const decidesOf = (data: Json | null): string[] => {
  if (!data) return [];
  const out: string[] = [];
  const perm = asObject(data.permissions);
  if (typeof perm.defaultMode === "string") out.push(`defaultMode=${perm.defaultMode}`);
  if (data.skipDangerousModePermissionPrompt === true) out.push("skipDangerousModePermissionPrompt");
  const env = asObject(data.env);
  if (GRANT_ENV in env) out.push(`印 ${GRANT_ENV}=${String(env[GRANT_ENV])}`);
  const allow = asStrings(perm.allow);
  const deny = asStrings(perm.deny);
  const ask = asStrings(perm.ask);
  if (allow.length) out.push(`allow ${allow.length} 行`);
  if (ask.length) out.push(`ask ${ask.length} 行`);
  if (deny.length) out.push(`deny ${deny.length} 行`);
  const hooks = asObject(data.hooks);
  const pre = Array.isArray(hooks.PreToolUse) ? hooks.PreToolUse : [];
  if (pre.length) out.push(`PreToolUse のフック ${pre.length}${JSON.stringify(pre).includes("devcheck/hook.mjs") ? "(許可の層あり)" : ""}`);
  const events = Object.keys(hooks).filter((k) => k !== "PreToolUse");
  if (events.length) out.push(`ほかのフック ${events.join(" / ")}`);
  if (Array.isArray(data.enabledMcpjsonServers)) out.push(`MCP 有効 ${asStrings(data.enabledMcpjsonServers).join(" / ") || "(なし)"}`);
  if (data.enableAllProjectMcpServers === true) out.push("MCP 全部有効(enableAllProjectMcpServers)");
  if (!out.length) out.push("(許可・フック・MCP に関わる項目なし)");
  return out;
};

/** 効いている設定ファイル(優先の高い順: managed → local → project → user。コマンドラインの --settings はここから見えない) */
export const showLayers = (paths: Paths): Layer[] => {
  const layers: Layer[] = [];
  const managed = paths.managed.find((f) => existsSync(f));
  const read = (file: string) => {
    try {
      return readSettings(file);
    } catch (error) {
      return { __unreadable: (error as Error).message } as Json;
    }
  };
  const layer = (scope: Layer["scope"], file: string): Layer => {
    const data = existsSync(file) ? read(file) : null;
    const decides = data && "__unreadable" in data ? [`読めない: ${String(data.__unreadable)}`] : decidesOf(data);
    return { scope, file, present: existsSync(file), decides };
  };
  layers.push(layer("managed", managed ?? paths.managed[0]));
  layers.push(layer("local", paths.local));
  layers.push(layer("project", paths.project));
  layers.push(layer("user", paths.user));
  return layers;
};

export const formatLayers = (layers: Layer[]): string =>
  [
    "効いている設定(優先の高い順。起動のコマンドラインの指定はここから見えない = チームの道具がタブごとに渡す設定も):",
    ...layers.map((l) => `- ${l.scope}: ${l.file}${l.present ? "" : "(無い)"}${l.present ? `\n    ${l.decides.join(" | ")}` : ""}`),
  ].join("\n");

/** 引数: --no-grant / --drop-deny=<行>(繰り返し)/ --bypass / --json */
export const parseOptions = (args: string[]): Options & { json: boolean } => {
  const options = { grant: true, dropDeny: [] as string[], bypass: false, json: false };
  for (const arg of args) {
    if (arg === "--no-grant") options.grant = false;
    else if (arg === "--bypass") options.bypass = true;
    else if (arg === "--json") options.json = true;
    else if (arg.startsWith("--drop-deny=")) options.dropDeny.push(arg.slice("--drop-deny=".length));
    else throw new LocalSettingsError(`知らない引数 ${arg}(--no-grant / --drop-deny=<行> / --bypass / --json)`);
  }
  return options;
};

/** 動作の外枠: LocalSettingsError は 1 行で exit 2 */
export const runAction = (fn: (args: string[]) => void) => {
  try {
    fn(process.argv.slice(2));
  } catch (error) {
    if (error instanceof LocalSettingsError) {
      console.error(`local-settings: ${error.message}`);
      process.exit(2);
    }
    throw error;
  }
};
