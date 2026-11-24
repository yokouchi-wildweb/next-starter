#!/usr/bin/env node
// .notices/20261125-033721-expiry-move.mjs
// 区切り expiry-move の道具(notice .notices/20261125-033721-expiry-move.md の uses:)。fork がリポのルートで走らせる。
// 移した物: 今の削除の定期処理 8 本が、持ち主のドメインの増設点 expiryRules の項目になった(1 本の cron expiry-prune が回す)。
// 旧 cron は区切り expiry-retire-crons まで残るが、そこで消える = fork の task.override.ts の disabled は効かなくなる。
// この道具は、旧 cron を disabled: true で止めている fork のために、対応する項目の上書き <名前>.override.ts に enabled: false を書く。
//
// 使い方: node .notices/20261125-033721-expiry-move.mjs [--json]   … dry-run(並べるだけ、書かない)
//         node .notices/20261125-033721-expiry-move.mjs --apply    … 項目の上書きを書く
//
// 読むのは src/app/api/cron/<旧 cron 8 本>/task.override.ts と、項目の上書き src/domains/core/<ドメイン>/plugs/expiryRules/<名前>.override.ts だけ
// (typescript の構文木で、字面の値だけ)。書くのは項目の上書きだけ。
// - disabled: true + 個人情報でない項目 → 上書き export const override = { enabled: false } を書く(同じ上書きがあれば済み = 何度流しても同じ)
// - disabled: true + 個人情報の項目(pii: true は上書きで止められない)→ 何も書かず、問いを出して止める(exit 2)
// - disabled 以外の鍵(schedule など)→ 旧 cron が消えると効かなくなる、と知らせるだけ(項目に時刻は無い。expiry-prune が 1 日 1 回)
// - 止める(exit 2、その回は何も書かない): 個人情報の項目を止めている / cronOverride が字面のオブジェクトでない /
//   項目の上書きが既にあって enabled: false だけの形でない(人が重ねる)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

export const SELF = ".notices/20261125-033721-expiry-move.mjs";

/** 旧 cron → 項目(区切り expiry-move の時点の上流) */
export const MOVES = Object.freeze([
  { cron: "audit-log-prune", domain: "auditLog", name: "auditLogPrune", pii: true },
  { cron: "device-fingerprint-prune", domain: "deviceFingerprint", name: "deviceFingerprintPrune", pii: true },
  { cron: "fingerprint-challenge-access-prune", domain: "fingerprintChallenge", name: "fingerprintChallengeAccessPrune", pii: true },
  { cron: "interaction-event-prune", domain: "interactionTracking", name: "interactionEventPrune", pii: true },
  { cron: "user-daily-counter-prune", domain: "userCounter", name: "userDailyCounterPrune", pii: true },
  { cron: "user-login-event-prune", domain: "userLoginEvent", name: "userLoginEventPrune", pii: true },
  { cron: "wallet-lots-prune", domain: "wallet", name: "walletLotsPrune", pii: false },
  { cron: "paired-device-pairings-prune", domain: "pairedDevice", name: "pairedDevicePairingsPrune", pii: false },
]);

export const cronOverridePath = (move) => `src/app/api/cron/${move.cron}/task.override.ts`;
export const itemOverridePath = (move) => `src/domains/core/${move.domain}/plugs/expiryRules/${move.name}.override.ts`;

/** 書く上書きの中身 */
export function itemOverrideText(move) {
  return `// ${itemOverridePath(move)}
// 旧 cron ${move.cron} を task.override.ts の disabled: true で止めていたので、移った項目も止める(${SELF} が書いた)

import type { ExpiryRule } from "@/lib/cron/points";

export const override = { enabled: false } satisfies Pick<ExpiryRule, "enabled" | "batchSize">;
`;
}

const propName = (name) => (ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null);
const unwrap = (expr) => {
  while (expr && (ts.isSatisfiesExpression(expr) || ts.isAsExpression(expr) || ts.isParenthesizedExpression(expr))) expr = expr.expression;
  return expr;
};
const literalValue = (expr) => {
  if (expr.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expr.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
  if (ts.isNumericLiteral(expr)) return Number(expr.text);
  return undefined;
};

/**
 * export const <exportName> = { … } の字面の鍵と値を読む(純関数)
 * @returns {{ ok: true, values: Record<string, unknown> } | { ok: false, reason: string }}
 */
export function readExportedObject(text, exportName, label) {
  const sf = ts.createSourceFile(label, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const node of sf.statements) {
    if (!ts.isVariableStatement(node) || !node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const decl of node.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.name.text !== exportName) continue;
      const expr = unwrap(decl.initializer);
      if (!expr || !ts.isObjectLiteralExpression(expr)) return { ok: false, reason: `${label}: ${exportName} が字面のオブジェクトでない` };
      const values = {};
      for (const prop of expr.properties) {
        const name = ts.isPropertyAssignment(prop) ? propName(prop.name) : null;
        if (!name) return { ok: false, reason: `${label}: 字面でない項目 ${prop.getText(sf).slice(0, 60)}` };
        const value = literalValue(prop.initializer);
        if (value === undefined) return { ok: false, reason: `${label}: ${name} の値が字面でない` };
        values[name] = value;
      }
      return { ok: true, values };
    }
  }
  return { ok: false, reason: `${label}: export const ${exportName} が無い` };
}

/**
 * 決める(純関数)。read(path) = ファイルの中身か null
 * @returns {{ ok: true, write: Move[], done: Move[], notes: string[] } | { ok: false, stops: string[], notes: string[] }}
 */
export function planMoves(read) {
  const write = [];
  const done = [];
  const notes = [];
  const stops = [];
  for (const move of MOVES) {
    const cronText = read(cronOverridePath(move));
    if (cronText === null) continue;
    const cron = readExportedObject(cronText, "cronOverride", cronOverridePath(move));
    if (!cron.ok) {
      stops.push(`${cron.reason}。人が直す`);
      continue;
    }
    const others = Object.keys(cron.values).filter((key) => key !== "disabled");
    if (others.length > 0)
      notes.push(
        `${move.cron}: ${others.join("・")} は旧 cron が区切り expiry-retire-crons で消えると効かなくなる(項目 ${move.domain}/${move.name} に時刻は無い。cron expiry-prune が 1 日 1 回回す)`,
      );
    if (cron.values.disabled !== true) continue;
    if (move.pii) {
      stops.push(
        `${move.cron} を止めているが、移った項目 ${move.domain}/${move.name} は個人情報の削除(pii: true)で上書きで止められない。` +
          `止めたままにするなら upstream へ /order(理由を書く)、動かすなら ${cronOverridePath(move)} を消す`,
      );
      continue;
    }
    const target = itemOverridePath(move);
    const existing = read(target);
    if (existing === null) {
      write.push(move);
      continue;
    }
    const current = readExportedObject(existing, "override", target);
    if (current.ok && Object.keys(current.values).length === 1 && current.values.enabled === false) done.push(move);
    else stops.push(`${target} が既にあり、enabled: false だけの形でない(${current.ok ? JSON.stringify(current.values) : current.reason})。人が enabled: false を重ねる`);
  }
  if (stops.length > 0) return { ok: false, stops, notes };
  return { ok: true, write, done, notes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const root = process.cwd();
  const read = (path) => (existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : null);
  const plan = planMoves(read);
  if (args.includes("--json")) console.log(JSON.stringify(plan, null, 2));
  else {
    for (const note of plan.notes) console.log(`知らせ: ${note}`);
    if (!plan.ok) for (const stop of plan.stops) console.error(`止めた(何も書いていない): ${stop}`);
    else {
      for (const move of plan.done) console.log(`${move.cron}: 済み(${itemOverridePath(move)} は enabled: false)`);
      for (const move of plan.write) console.log(`${move.cron}: ${itemOverridePath(move)} に enabled: false を${args.includes("--apply") ? "書いた" : "書く(--apply)"}`);
      if (plan.write.length === 0 && plan.done.length === 0) console.log("書く物なし(旧 cron を disabled で止めていない)");
    }
  }
  if (!plan.ok) process.exit(2);
  if (args.includes("--apply"))
    for (const move of plan.write) {
      const path = join(root, itemOverridePath(move));
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, itemOverrideText(move));
    }
  process.exit(0);
}
