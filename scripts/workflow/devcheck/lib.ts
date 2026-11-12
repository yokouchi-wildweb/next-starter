// scripts/workflow/devcheck/lib.ts
//
// pnpm workflow devcheck の部品(読むだけの層)。開発中の確かめの入口が、事実と候補を出すための物。
// - KINDS・方針の実体は lib.kinds.mjs(許可のフックも読む唯一の置き場)。ここは型を付けて出し直す
// - 方針: policy.json(上流の実体、全部 auto)に policy.override.ts(fork、上流は出さない)の宣言した鍵(POLICY_KEYS = 種類 + peer)だけを重ねる。auto | manual | off
// - fork の項目: items/<名前>.json = { name, kind, command, what }。command はこのリポの入口(pnpm <script> / pnpm workflow / pnpm ops)だけ
// - 文脈: 環境変数 DEVCHECK_CONTEXT=<絶対パス> の版つき key=value のファイル。無い = 単体、あるのに読めない・知らない版 = 止める
// - 計画: 事実(方針・項目・文脈・今の状態)と候補。最後はいつも片付け
// 規則と使い方: scripts/workflow/devcheck/README.md

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  DevcheckError,
  HOOK_KINDS as HOOK_KINDS_DATA,
  KIND_NAMES as KIND_NAMES_DATA,
  KINDS as KINDS_DATA,
  POLICY_KEYS as POLICY_KEYS_DATA,
  POLICY_VALUES as POLICY_VALUES_DATA,
  loadPolicy as loadPolicyData,
  mergePolicy as mergePolicyData,
} from "./lib.kinds.mjs";
import { isBackground, isBackgroundAlive, isTabAlive, readState, type DevTabState } from "../dev-tab/lib";

export { DevcheckError } from "./lib.kinds.mjs";

// ---- 種類 ---------------------------------------------------------------------------------

export type KindName = "server" | "browser" | "login" | "db-write" | "db-delete" | "env-add" | "test" | "check";

export type Kind = {
  /** 何をするか(候補の 1 行に出す) */
  what: string;
  /** 打つコマンドの形(null = 命令ではなくエージェントが道具で行う) */
  command: string | null;
  /** 何かを書くか(DB・ファイル・プロセス) */
  writes: boolean;
};

/** やることの種類と打つコマンドの形(実体は lib.kinds.mjs、許可のフックと同じ物) */
export const KINDS = KINDS_DATA as Record<KindName, Kind>;

export const KIND_NAMES = KIND_NAMES_DATA as KindName[];

/** 許可のフックだけの種類(計画の候補には出ない)と、方針の鍵(種類 + フックだけの種類) */
export type HookKindName = "peer";
export const HOOK_KINDS = HOOK_KINDS_DATA as HookKindName[];
export type PolicyKey = KindName | HookKindName;
export const POLICY_KEYS = POLICY_KEYS_DATA as PolicyKey[];

/** サーバーの種類の打つコマンド(文脈が裏を求めれば --background) */
export const serverCommand = (server: ContextServer): string =>
  server === "background" ? `${KINDS.server.command} --background` : (KINDS.server.command as string);

// ---- 方針 ---------------------------------------------------------------------------------

export type PolicyValue = "auto" | "manual" | "off";
export const POLICY_VALUES = POLICY_VALUES_DATA as readonly PolicyValue[];
export type Policy = Record<PolicyKey, PolicyValue>;

/** 方針の実体(印なし)と、その一部を重ねる上書き(<対象>.override.ts、export const override = { … })。読み方は lib.kinds.mjs */
export { POLICY_FILE, POLICY_OVERRIDE_FILE, readOverride } from "./lib.kinds.mjs";

/** 実体に fork の上書きの宣言した鍵だけを重ねる(上書きは無くてよい)。宣言に無い鍵・値の誤りは DevcheckError */
export const mergePolicy = (defaults: unknown, override: unknown | null): Policy => mergePolicyData(defaults, override) as Policy;

/** この道具のフォルダから方針を読む: 実体(policy.json)+ 上書き(policy.override.ts)の宣言した鍵だけ */
export const loadPolicy = async (dir: string): Promise<Policy> => (await loadPolicyData(dir)) as Policy;

// ---- fork の項目 --------------------------------------------------------------------------

export type Item = { name: string; kind: KindName; command: string; what: string; file: string };
export type RejectedItem = { file: string; reason: string };

/** シェルの記号(つなぐ・流す・置き換える)。項目のコマンドは 1 つの入口だけ */
const SHELL_OPERATORS = /[;&|<>`]|\$\(/;

/** このリポの入口か: pnpm <package.json の script> / pnpm workflow <対象> <動作> / pnpm ops <対象> <動作> */
export const isRepoEntry = (command: string, repoRoot: string, scripts: Record<string, string>): boolean => {
  const words = command.trim().split(/\s+/);
  if (words[0] !== "pnpm" || !words[1]) return false;
  if (words[1] === "workflow" || words[1] === "ops") {
    const kindDir = words[1] === "workflow" ? "workflow" : "operations";
    const [tool, action] = [words[2], words[3]];
    if (!tool || !action || !/^[A-Za-z0-9_-]+$/.test(tool) || !/^[A-Za-z0-9_-]+$/.test(action)) return false;
    return [".mjs", ".js", ".ts"].some((ext) => existsSync(path.join(repoRoot, "scripts", kindDir, tool, `${action}${ext}`)));
  }
  return Object.hasOwn(scripts, words[1]);
};

/** items/*.json を読み、使える項目と断った項目に分ける(断った項目は候補に出さない) */
export const scanItems = (itemsDir: string, repoRoot: string, scripts: Record<string, string>): { items: Item[]; rejected: RejectedItem[] } => {
  const items: Item[] = [];
  const rejected: RejectedItem[] = [];
  if (!existsSync(itemsDir)) return { items, rejected };
  for (const entry of readdirSync(itemsDir).filter((f) => f.endsWith(".json")).sort()) {
    const file = path.join(itemsDir, entry);
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      rejected.push({ file: entry, reason: "JSON として読めない" });
      continue;
    }
    const { name, kind, command, what } = data ?? {};
    if (typeof name !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(name)) rejected.push({ file: entry, reason: "name は英小文字・数字・ハイフン" });
    else if (!(KIND_NAMES as unknown[]).includes(kind)) rejected.push({ file: entry, reason: `kind は ${KIND_NAMES.join(" / ")} のどれか` });
    else if (typeof command !== "string" || command.trim() === "") rejected.push({ file: entry, reason: "command がない" });
    else if (SHELL_OPERATORS.test(command)) rejected.push({ file: entry, reason: "command にシェルの記号(; & | < > ` $()は使えない" });
    else if (/(^|\s)(--env|--confirm)(=|\s|$)|db:push/.test(command)) rejected.push({ file: entry, reason: "command に本番の指定・db:push は使えない" });
    else if (!isRepoEntry(command, repoRoot, scripts)) rejected.push({ file: entry, reason: "command はこのリポの入口(pnpm <script> / pnpm workflow / pnpm ops)だけ" });
    else items.push({ name, kind: kind as KindName, command: command.trim(), what: typeof what === "string" ? what : "", file: entry });
  }
  return { items, rejected };
};

// ---- 文脈(DEVCHECK_CONTEXT) -------------------------------------------------------------

export const CONTEXT_ENV = "DEVCHECK_CONTEXT";
export const CONTEXT_VERSION = "1";
export type ContextServer = "tab" | "background";
export type Context = {
  /** 文脈ファイルのパス(null = 単体) */
  file: string | null;
  /** each = 毎回 go を取る / auto = go を取らずに進める */
  approval: "each" | "auto";
  server: ContextServer;
  /** 同時に動かしてよい dev-tab の数(null = 数えない) */
  devMax: number | null;
  workdirs: string[];
};

export const STANDALONE: Context = { file: null, approval: "each", server: "tab", devMax: null, workdirs: [] };

/** 文脈ファイルの中身を読む(版つき key=value、# から後は注釈)。知らない版・鍵・値は DevcheckError */
export const parseContext = (text: string, file: string): Context => {
  const ctx: Context = { ...STANDALONE, file, workdirs: [] };
  let version: string | null = null;
  for (const [n, raw] of text.split("\n").entries()) {
    const line = raw.replace(/#.*/, "").trim();
    if (line === "") continue;
    const m = /^([a-z_]+)=(.*)$/.exec(line);
    if (!m) throw new DevcheckError(`${CONTEXT_ENV}=${file}: ${n + 1} 行目が key=value でない`);
    const [, key, value] = m;
    if (key === "v") version = value;
    else if (key === "approval") {
      if (value !== "each" && value !== "auto") throw new DevcheckError(`${CONTEXT_ENV}=${file}: approval は each / auto`);
      ctx.approval = value;
    } else if (key === "server") {
      if (value !== "tab" && value !== "background") throw new DevcheckError(`${CONTEXT_ENV}=${file}: server は tab / background`);
      ctx.server = value;
    } else if (key === "dev_max") {
      if (!/^[1-9]\d*$/.test(value)) throw new DevcheckError(`${CONTEXT_ENV}=${file}: dev_max は 1 以上の整数`);
      ctx.devMax = Number(value);
    } else if (key === "workdir") {
      if (!path.isAbsolute(value)) throw new DevcheckError(`${CONTEXT_ENV}=${file}: workdir は絶対パス`);
      ctx.workdirs.push(value);
    } else throw new DevcheckError(`${CONTEXT_ENV}=${file}: 知らない鍵 ${key}`);
  }
  if (version === null) throw new DevcheckError(`${CONTEXT_ENV}=${file}: 版 v がない`);
  if (version !== CONTEXT_VERSION) throw new DevcheckError(`${CONTEXT_ENV}=${file}: 知らない版 v=${version}(読めるのは v=${CONTEXT_VERSION})`);
  return ctx;
};

/** 環境変数から文脈を読む: 無い = 単体、あるのに読めない・知らない版 = DevcheckError(呼ばれるたびに読む) */
export const loadContext = (env: Record<string, string | undefined>): Context => {
  const file = (env[CONTEXT_ENV] ?? "").trim();
  if (file === "") return STANDALONE;
  if (!path.isAbsolute(file)) throw new DevcheckError(`${CONTEXT_ENV}=${file}: 絶対パスにする`);
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    throw new DevcheckError(`${CONTEXT_ENV}=${file}: ファイルが読めない`);
  }
  return parseContext(text, file);
};

// ---- 今の状態 -----------------------------------------------------------------------------

/** このリポのワークツリー(本体を含む)のパス */
export const worktreePaths = (repoRoot: string): string[] => {
  try {
    const out = execFileSync("git", ["worktree", "list", "--porcelain"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out
      .split("\n")
      .filter((l) => l.startsWith("worktree "))
      .map((l) => l.slice("worktree ".length));
  } catch {
    return [repoRoot];
  }
};

/** 記録が生きているか(読むだけ: 死んだ記録を消さない) */
export const isRecordAlive = (state: DevTabState): boolean => (isBackground(state) ? isBackgroundAlive(state) : isTabAlive(state));

/** dev-tab の生きている記録の数(このリポのワークツリー全部) */
export const countLiveServers = (paths: string[], read: (root: string) => DevTabState | null = readState, alive = isRecordAlive): number =>
  paths.filter((p) => {
    const state = read(p);
    return state !== null && alive(state);
  }).length;

export type ServerFact = { line: string; answering: boolean } | null;
/** 管理者の有無(pnpm workflow dev-admin run --check の答え。読むだけ) */
export type AdminFact = { present: boolean } | { unknown: string };
export type State = { server: ServerFact; liveServers: number; admin: AdminFact };

/** dev-admin run --check の答え(JSON 1 行、成功は stdout・失敗は stderr)を事実にする */
export const parseAdminCheck = (code: number, stdout: string, stderr: string): AdminFact => {
  const last = (text: string) => text.trim().split("\n").filter(Boolean).at(-1) ?? "";
  try {
    const data = JSON.parse(last(code === 0 ? stdout : stderr));
    if (code === 0 && typeof data.present === "boolean") return { present: data.present };
    if (typeof data.error === "string") return { unknown: data.error };
  } catch {
    // 下で
  }
  return { unknown: last(stderr) || last(stdout) || `終了コード ${code}` };
};

// ---- 計画 ---------------------------------------------------------------------------------

export type Candidate = { name: string; kind: KindName | "cleanup"; policy: PolicyValue; command: string | null; what: string; source: "upstream" | "fork" };

export type Plan = {
  checkout: string;
  context: Context;
  policy: Policy;
  items: Item[];
  rejected: RejectedItem[];
  state: State;
  candidates: Candidate[];
};

/** 片付けの候補(計画の最後にいつも置く) */
export const CLEANUP: Candidate = {
  name: "cleanup",
  kind: "cleanup",
  policy: "auto",
  command: null,
  what: "片付け: この命令が立てたサーバーを止め、この命令で作った DB の行を消す(画面から作った行は『残した行』として報告)",
  source: "upstream",
};

/** 事実から計画を組む(純粋)。候補 = 上流の種類 + fork の項目、最後に片付け */
export const buildPlan = (input: Omit<Plan, "candidates">): Plan => {
  const upstream: Candidate[] = KIND_NAMES.map((kind) => ({
    name: kind,
    kind,
    policy: input.policy[kind],
    command: kind === "server" ? serverCommand(input.context.server) : KINDS[kind].command,
    what: KINDS[kind].what,
    source: "upstream",
  }));
  const fork: Candidate[] = input.items.map((item) => ({
    name: item.name,
    kind: item.kind,
    policy: input.policy[item.kind],
    command: item.command,
    what: item.what || KINDS[item.kind].what,
    source: "fork",
  }));
  return { ...input, candidates: [...upstream, ...fork, CLEANUP] };
};

/** 方針の言葉(人向け): auto = go 1 回でやる / manual = その項目だけ別に go を取る / off = この命令はしない(手で) */
export const policyLabel = (value: PolicyValue): string => ({ auto: "自動", manual: "別に確認", off: "手で" })[value];

/** 計画の文(人向け) */
export const formatPlan = (plan: Plan): string => {
  const ctx = plan.context;
  const lines = [
    `devcheck plan — ${plan.checkout}`,
    `文脈: ${ctx.file ? `${ctx.file}(approval=${ctx.approval}、server=${ctx.server}、dev_max=${ctx.devMax ?? "-"}、作業場所 ${ctx.workdirs.length})` : "単体(毎回 go を取る・サーバーは自分で立てる)"}`,
    ...formatState(plan.state, ctx).map((l) => l),
    `方針: ${KIND_NAMES.map((k) => `${k}=${plan.policy[k]}`).join(" ")}`,
  ];
  if (plan.rejected.length > 0) lines.push(`断った fork の項目: ${plan.rejected.map((r) => `${r.file}(${r.reason})`).join("、")}`);
  lines.push("候補:");
  for (const c of plan.candidates) {
    const label = c.kind === "cleanup" ? "最後に必ず" : policyLabel(c.policy);
    lines.push(`- ${c.name} [${c.kind === "cleanup" ? "cleanup" : c.kind}・${label}${c.source === "fork" ? "・fork" : ""}] ${c.what}${c.command ? `: ${c.command}` : ""}`);
  }
  return lines.join("\n");
};

/** 状態の文(人向け) */
export const formatState = (state: State, ctx: Context): string[] => [
  `サーバー: ${state.server ? `${state.server.line}(${state.server.answering ? "応答あり" : "応答なし"})` : "この作業場所には無い"}`,
  `動いている dev-tab: ${state.liveServers}${ctx.devMax !== null ? ` / 上限 ${ctx.devMax}` : ""}`,
  `管理者: ${"present" in state.admin ? (state.admin.present ? "いる" : "いない(login で作る)") : `分からない(${state.admin.unknown})`}`,
];
