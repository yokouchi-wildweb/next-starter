// scripts/workflow/devcheck/lib.allow.mjs
//
// 1 回分の許可(D123・D124): 方針が manual の種類を、人の /allow <スイッチ名…> か言葉の許可で 1 回だけ通すための記録。
// - 置き場: <チェックアウト>/.agent/devcheck-allow.json = { v: 1, switches: [...], words, at }
// - 書くのは pnpm workflow devcheck allow だけ(直接の書き換えは許可のフックの固定の止め)
// - 寿命: 使ったスイッチは許可のフックが消す / 次の人の入力(UserPromptSubmit の hook.mjs prompt)で全部消える = 同じ番の中だけ
// - フックからは誰が allow を打ったかは見えない。人の言葉が要る決まりは /allow スキルの文が守る(D118 c)
// 規則と使い方: scripts/workflow/devcheck/README.md「方針」「許可の層」

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

export const PERMIT_FILE = ".agent/devcheck-allow.json";

/** @param {string} root */
const permitPath = (root) => path.join(root, PERMIT_FILE);

/**
 * 今の許可(無い・読めない = null)
 * @param {string} root
 * @returns {{ switches: string[], words: string, at: string } | null}
 */
export const readPermit = (root) => {
  const file = permitPath(root);
  if (!existsSync(file)) return null;
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    if (!data || !Array.isArray(data.switches)) return null;
    return { switches: data.switches.filter((s) => typeof s === "string"), words: typeof data.words === "string" ? data.words : "", at: String(data.at ?? "") };
  } catch {
    return null;
  }
};

/**
 * 許可を書く(同じ番の中の前の許可に足す)
 * @param {string} root @param {string[]} switches @param {string} words
 */
export const writePermit = (root, switches, words, now = new Date()) => {
  const prev = readPermit(root);
  const merged = [...new Set([...(prev?.switches ?? []), ...switches])];
  const file = permitPath(root);
  mkdirSync(path.dirname(file), { recursive: true });
  const data = { v: 1, switches: merged, words: [prev?.words, words].filter(Boolean).join(" / "), at: now.toISOString() };
  writeFileSync(file, `${JSON.stringify(data)}\n`);
  return data;
};

/**
 * 使ったスイッチを消す(残りが無ければファイルごと)
 * @param {string} root @param {string} sw
 */
export const consumePermit = (root, sw) => {
  const prev = readPermit(root);
  if (!prev) return;
  const rest = prev.switches.filter((s) => s !== sw);
  if (rest.length === 0) clearPermit(root);
  else writeFileSync(permitPath(root), `${JSON.stringify({ v: 1, switches: rest, words: prev.words, at: prev.at })}\n`);
};

/** 全部消す(次の人の入力) @param {string} root */
export const clearPermit = (root) => rmSync(permitPath(root), { force: true });

// ---- 命令の本体(allow.ts・danger.ts、テストもここを呼ぶ) ------------------------------------------

/**
 * allow: スイッチ名ごとに確かめて許可を書く。{ code, lines }
 * code 0 = 書いた / 2 = 知らないスイッチ / 4 = 方針で断った(off は人に頼む 1 行、auto は許可が要らない)
 * @param {string} root @param {string[]} switches @param {string} words
 * @param {{ policy: Record<string, string>, entries: Record<string, Record<string, string>> }} agent
 * @param {{ SWITCHES: Record<string, string>, offLine: (kind: string, entries: object) => string }} kinds
 */
export const runAllow = (root, switches, words, agent, kinds, now = new Date()) => {
  if (switches.length === 0) return { code: 2, lines: [`使い方: pnpm workflow devcheck allow <スイッチ名…> [--words "<人の言葉>"](スイッチ名 = ${Object.keys(kinds.SWITCHES).join(" ")})`] };
  const unknown = switches.filter((sw) => !(sw in kinds.SWITCHES));
  if (unknown.length) return { code: 2, lines: [`知らないスイッチ名 ${unknown.join(" ")}(使える名前 = ${Object.keys(kinds.SWITCHES).join(" ")})`] };
  const lines = [];
  const ok = [];
  for (const sw of switches) {
    const kind = kinds.SWITCHES[sw];
    const value = agent.policy[kind];
    if (value === "off") lines.push(kinds.offLine(kind, agent.entries));
    else if (value === "auto") lines.push(`${sw}(${kind})は方針で auto: 許可は要らない(計画を見せて go 1 回で行う)`);
    else ok.push(sw);
  }
  if (ok.length === 0) return { code: 4, lines };
  const data = writePermit(root, ok, words, now);
  lines.unshift(`1 回分の許可: ${ok.join(" ")}(使うと消える。次の人の入力でも消える)${data.words ? ` 言葉: ${data.words}` : ""}`);
  return { code: lines.length > 1 ? 4 : 0, lines };
};

/**
 * danger: 危険な種類に今できること(読むだけ)。{ code, lines }
 * 0 = 打ってよい命令を出した / 2 = 危険な種類のスイッチ名でない / 4 = off(人に頼む 1 行)・許可が無い・上流の入口なし
 * @param {string} root @param {string} sw
 * @param {{ policy: Record<string, string>, entries: Record<string, Record<string, string>> }} agent
 * @param {{ SWITCHES: Record<string, string>, DANGER_NAMES: string[], offLine: (kind: string, entries: object) => string, policyKeyOf: (kind: string) => string }} kinds
 */
export const runDanger = (root, sw, agent, kinds) => {
  const kind = kinds.SWITCHES[sw];
  if (!kind || !kinds.DANGER_NAMES.includes(kind)) return { code: 2, lines: [`危険な種類のスイッチ名は ${kinds.DANGER_NAMES.map((k) => Object.keys(kinds.SWITCHES).find((s) => kinds.SWITCHES[s] === k)).join(" / ")}`] };
  if (agent.policy[kind] !== "manual") return { code: 4, lines: [kinds.offLine(kind, agent.entries)] };
  const entry = agent.entries[kind] ?? {};
  if (entry.entry === "-") return { code: 4, lines: [`${kind}: 上流の入口なし(人が手で行う。fork は ${kinds.policyKeyOf(kind)}.entry に自分の命令を書く)`] };
  const permit = readPermit(root);
  if (!permit?.switches.includes(sw)) return { code: 4, lines: [`${kind} は方針で manual: 人の /allow ${sw}(か言葉の許可)が要る。許可の後にもう一度`] };
  const commands = kind === "deploy"
    ? [...(entry.db_entry && entry.db_entry !== "-" ? [`(スキーマが変わる時だけ、先に)${entry.db_entry} --confirm=production`] : []), entry.entry === "pnpm live" ? "pnpm live -- --confirm=production" : entry.entry]
    : [entry.entry];
  return { code: 0, lines: [`${kind}: 1 回分の許可あり。打つ命令(この順、1 回だけ):`, ...commands.map((c) => `  ${c}`)] };
};
