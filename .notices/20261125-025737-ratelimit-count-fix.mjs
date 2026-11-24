#!/usr/bin/env node
// .notices/20261125-025737-ratelimit-count-fix.mjs
// 区切り ratelimit-count-fix の道具(notice .notices/20261125-025737-ratelimit-count-fix.md の uses:)。fork がリポのルートで走らせる。
// 直した物: checkRateLimit(route の rateLimit も)が、前は窓の中で maxRequests − 1 回(maxRequests ≤ 2 は 1 回)で止めていたのを、
// maxRequests 回まで通す。上流のカテゴリの既定はそのまま(どのカテゴリも 1 回多く通る)。
// この道具は fork が自分で足した・値を変えたカテゴリだけを並べ、1 つずつ「今と同じにする(maxRequests を 1 減らす)/ そのまま」を聞く。
//
// 使い方: node .notices/20261125-025737-ratelimit-count-fix.mjs [--json]                      … dry-run(聞く物を並べるだけ、書かない)
//         node .notices/20261125-025737-ratelimit-count-fix.mjs --apply <名前>=same|keep …     … 答えた行だけを書く
//
// 読むのは src/config/domains/rateLimit.config.ts だけ(typescript の構文木で、字面の値だけ)。上流の値はこの notice の時点の写しを下に持つ
// - 並べる: Extra の型で足したカテゴリ / 上流のカテゴリで maxRequests を上流と違う値に書いた行(同じ値・窓だけの変更は並べない)
// - maxRequests 1 は直した後も 1 回なので「変わらない」と出して聞かない(2 以上は聞く。same → N − 1)
// - maxRequests が数の字面でない行(式・呼び出し・名前。例 isDevelopment() ? 100 : 7)は道具が回数を読めないので「手で見る: <名前>(<字面>)」と並べるだけ
//   (exit 0。印は付けない = 何度流しても並ぶ)。その行は人が自分で直す(今と同じにするなら N − 1)
// - 書く: same = その行の maxRequests の数字を N − 1 に、どちらも数字の直後に印のコメント /* ratelimit-count-fix: same (was N) */ か
//   /* ratelimit-count-fix: keep */。印のある行は済み(二度と聞かない・書かない)= 何度流しても同じ。ほかの字面・書式は触らない
// - 止める(exit 2、何も書かない): 既定の書き出しの中が字面でない(展開・計算した鍵・行の値が変数)、--apply の名前が並べた物に無い・手で見る行、
//   same で 1 より下になる、答えが same / keep でない

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

export const CONFIG_PATH = "src/config/domains/rateLimit.config.ts";
export const MARK = "ratelimit-count-fix";

/** 上流(Tier1)のカテゴリの maxRequests(この notice の時点の src/domains/core/rateLimit/config.ts の写し) */
export const UPSTREAM_MAX_REQUESTS = Object.freeze({
  signupEmail: 7,
  signupRegister: 3,
  signupSubnet: 3,
  login: 5,
  loginSubnet: 20,
  passwordReset: 3,
  guestLogin: 5,
  apiGeneral: 60,
  interactionIngest: 60,
  interactionIngestSubnet: 300,
  interactionBatch: 20,
  interactionBatchSubnet: 120,
  pairedDeviceClaim: 100,
  pairedDevicePairingStart: 20,
  pairedDevicePairingPoll: 60,
  pairedDevicePairingPollIp: 600,
  pairedDeviceManage: 60,
  pairedDeviceManageIp: 300,
  adminSetup: 10,
  storageIssue: 30,
});

const propName = (name) => (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? name.text : null);

/** 数字の直後の印(済みの行) */
function markAfter(text, end) {
  const m = new RegExp(`^\\s*/\\*\\s*${MARK}:\\s*(same|keep)\\b[^*]*\\*/`).exec(text.slice(end));
  return m ? m[1] : null;
}

/**
 * 設定のファイルを読む(純関数)
 * @returns {{ ok: true, extra: string[], rows: Array<{ name, maxRequests: number|null, start, end, mark: "same"|"keep"|null, source?: string }> } | { ok: false, reason: string }}
 *   source = maxRequests が数の字面でない時のその字面(maxRequests は null、手で見る行)
 */
export function readConfig(text) {
  const sf = ts.createSourceFile("rateLimit.config.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const extra = [];
  let objectLiteral = null;
  for (const node of sf.statements) {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === "Extra" && ts.isTypeLiteralNode(node.type)) {
      for (const member of node.type.members) {
        const name = member.name ? propName(member.name) : null;
        if (name) extra.push(name);
      }
    }
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      let expr = node.expression;
      while (ts.isSatisfiesExpression(expr) || ts.isAsExpression(expr) || ts.isParenthesizedExpression(expr)) expr = expr.expression;
      if (!ts.isObjectLiteralExpression(expr)) return { ok: false, reason: "export default がオブジェクトの字面でない" };
      objectLiteral = expr;
    }
  }
  if (!objectLiteral) return { ok: false, reason: "export default が無い" };
  const rows = [];
  for (const prop of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(prop)) return { ok: false, reason: `字面でない項目: ${prop.getText(sf).slice(0, 60)}` };
    const name = propName(prop.name);
    if (!name) return { ok: false, reason: `計算した鍵: ${prop.name.getText(sf)}` };
    if (!ts.isObjectLiteralExpression(prop.initializer)) return { ok: false, reason: `${name} の値が字面のオブジェクトでない` };
    let maxRequests = null;
    let start = -1;
    let end = -1;
    let source;
    for (const field of prop.initializer.properties) {
      if (!ts.isPropertyAssignment(field)) return { ok: false, reason: `${name} に字面でない欄: ${field.getText(sf).slice(0, 60)}` };
      if (propName(field.name) !== "maxRequests") continue;
      if (!ts.isNumericLiteral(field.initializer)) {
        source = field.initializer.getText(sf);
        continue;
      }
      maxRequests = Number(field.initializer.text);
      start = field.initializer.getStart(sf);
      end = field.initializer.getEnd();
    }
    rows.push({ name, maxRequests, start, end, mark: end >= 0 ? markAfter(text, end) : null, ...(source !== undefined ? { source } : {}) });
  }
  return { ok: true, extra, rows };
}

/**
 * 聞く物を決める(純関数)
 * @returns {{ ok: true, ask: Row[], done: Row[], unchanged: Row[], manual: Array<{ name, origin: "added"|"upstream", source }> } | { ok: false, reason: string }}
 *   Row = { name, origin: "added"|"tuned", maxRequests, upstream?: number, mark? } | manual = maxRequests が数の字面でない行(手で見る)
 */
export function planRows(text) {
  const read = readConfig(text);
  if (!read.ok) return read;
  const ask = [];
  const done = [];
  const unchanged = [];
  const manual = [];
  for (const row of read.rows) {
    const added = read.extra.includes(row.name);
    if (row.source !== undefined) {
      manual.push({ name: row.name, origin: added ? "added" : "upstream", source: row.source });
      continue;
    }
    const upstream = Object.hasOwn(UPSTREAM_MAX_REQUESTS, row.name) ? UPSTREAM_MAX_REQUESTS[row.name] : undefined;
    if (row.maxRequests === null) continue; // 窓だけの変更(上流の maxRequests のまま = 上流と同じく 1 回多く通る)
    if (!added && (upstream === undefined || row.maxRequests === upstream)) continue;
    const entry = { name: row.name, origin: added ? "added" : "tuned", maxRequests: row.maxRequests, ...(upstream !== undefined && !added ? { upstream } : {}) };
    if (row.mark) done.push({ ...entry, mark: row.mark });
    else if (row.maxRequests < 1) return { ok: false, reason: `${row.name}.maxRequests が 1 より小さい(${row.maxRequests})。人が直す` };
    else if (row.maxRequests === 1) unchanged.push(entry);
    else ask.push(entry);
  }
  return { ok: true, ask, done, unchanged, manual };
}

/**
 * 答えを書く(純関数)。answers = { <名前>: "same" | "keep" }
 * @returns {{ ok: true, next: string, applied: Array<{ name, answer, from, to }> } | { ok: false, reason: string }}
 */
export function applyAnswers(text, answers) {
  const plan = planRows(text);
  if (!plan.ok) return plan;
  const read = readConfig(text);
  const askable = new Map(plan.ask.map((row) => [row.name, row]));
  const edits = [];
  for (const [name, answer] of Object.entries(answers)) {
    if (answer !== "same" && answer !== "keep") return { ok: false, reason: `${name} の答えは same か keep(${answer})` };
    const hand = plan.manual.find((row) => row.name === name);
    if (hand) return { ok: false, reason: `${name} は手で直す行(maxRequests が ${hand.source})。道具は書かない: 今と同じにするなら自分で 1 減らす` };
    if (!askable.has(name)) {
      const already = plan.done.find((row) => row.name === name) ?? plan.unchanged.find((row) => row.name === name);
      if (already) continue; // 済み・聞かない行は書かない(何度流しても同じ)
      return { ok: false, reason: `${name} は聞く物に無い(fork が足した・値を変えたカテゴリだけ)` };
    }
    const row = read.rows.find((r) => r.name === name);
    const to = answer === "same" ? row.maxRequests - 1 : row.maxRequests;
    if (to < 1) return { ok: false, reason: `${name} を same にすると ${to} になる。人が決める` };
    const note = answer === "same" ? `/* ${MARK}: same (was ${row.maxRequests}) */` : `/* ${MARK}: keep */`;
    edits.push({ name, answer, from: row.maxRequests, to, start: row.start, end: row.end, replacement: `${to} ${note}` });
  }
  let next = text;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) next = next.slice(0, edit.start) + edit.replacement + next.slice(edit.end);
  return { ok: true, next, applied: edits.map(({ name, answer, from, to }) => ({ name, answer, from, to })) };
}

/** --apply の後ろの <名前>=same|keep を読む */
export function parseAnswers(args) {
  const answers = {};
  for (const arg of args) {
    const m = /^([^=]+)=(.*)$/.exec(arg);
    if (!m) return { ok: false, reason: `答えの形は <名前>=same|keep(${arg})` };
    answers[m[1]] = m[2];
  }
  return { ok: true, answers };
}

const describe = (row) =>
  row.origin === "added" ? `maxRequests ${row.maxRequests}(自分で足したカテゴリ)` : `maxRequests ${row.maxRequests}(上流の ${row.upstream} から変えた)`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const path = join(process.cwd(), CONFIG_PATH);
  const self = ".notices/20261125-025737-ratelimit-count-fix.mjs";
  if (!existsSync(path)) {
    console.log(`${CONFIG_PATH} が無い: 聞く物なし`);
    process.exit(0);
  }
  const text = readFileSync(path, "utf8");
  const applyAt = args.indexOf("--apply");
  if (applyAt >= 0) {
    const parsed = parseAnswers(args.slice(applyAt + 1).filter((arg) => arg !== "--json"));
    const result = parsed.ok ? applyAnswers(text, parsed.answers) : parsed;
    if (!result.ok) {
      console.error(`止めた(何も書いていない): ${result.reason}`);
      process.exit(2);
    }
    if (result.next !== text) writeFileSync(path, result.next);
    for (const a of result.applied) console.log(`${a.name}: ${a.answer === "same" ? `maxRequests ${a.from} → ${a.to}(今と同じ回数)` : `maxRequests ${a.from} のまま(1 回多く通る)`}`);
    if (result.applied.length === 0) console.log("書く物なし(済み・聞かない行だけ)");
    process.exit(0);
  }
  const plan = planRows(text);
  if (!plan.ok) {
    console.error(`止めた: ${plan.reason}`);
    process.exit(2);
  }
  if (args.includes("--json")) {
    console.log(JSON.stringify(plan, null, 2));
    process.exit(0);
  }
  if (plan.ask.length === 0) console.log("聞く物なし(fork が足した・値を変えたカテゴリで、答えていない物は無い)");
  for (const row of plan.manual) console.log(`手で見る: ${row.name}(${row.source})`);
  for (const row of plan.ask) console.log(`${row.name}: ${describe(row)} → 今と同じにする(maxRequests を 1 減らす: ${row.maxRequests - 1})/ そのまま(1 回多く通る)`);
  for (const row of plan.unchanged) console.log(`${row.name}: ${describe(row)} → 変わらない(1 回のまま)`);
  for (const row of plan.done) console.log(`${row.name}: 済み(${row.mark})`);
  if (plan.ask.length > 0) console.log(`答え: node ${self} --apply ${plan.ask.map((row) => `${row.name}=same|keep`).join(" ")}`);
  process.exit(0);
}
