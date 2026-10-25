// domainEntry.ts の access をプリセット名（ADMIN_ONLY 等）で出力するためのヘルパー。
//
// 方針:
// - read / write がプリセットと構造的に一致すればプリセットの spread（`...PUBLIC_READ`）を、一致しなければ JSON リテラルを出力する
// - 管理データ操作（truncateAll / export / import）は operations に必ず明示する（未指定 = none のため、生成物で意図を読めるようにする）

// src/config/app/domain-api-access.config.ts のプリセットの写し。
// 値の一致は registry.test.mjs が TS 側を読み込んで検証する（片方だけ変えるとテストが落ちる）。
const ADMIN_RULE = { roleCategories: ['admin'] };
const ADMIN_OR_DEBUGGER_RULE = { roles: ['debugger'], roleCategories: ['admin'] };
export const ACCESS_PRESETS = {
  ADMIN_ONLY: { read: ADMIN_RULE, write: ADMIN_RULE },
  PUBLIC_READ: { read: 'public', write: ADMIN_RULE },
  ADMIN_OR_DEBUGGER: { read: ADMIN_OR_DEBUGGER_RULE, write: ADMIN_OR_DEBUGGER_RULE },
  INTERNAL_ONLY: { read: 'none', write: 'none' },
};
export const PRESET_RULES = { ADMIN_RULE, ADMIN_OR_DEBUGGER_RULE };
export const PRESET_MODULE = '@/config/app/domain-api-access.config';

// キー順を問わない構造比較（配列は順序込み）
export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]));
}

/** 単一ルールを TS 式に。プリセットのルール名と一致すれば名前、無ければ JSON */
export function serializeRule(rule) {
  const preset = Object.entries(PRESET_RULES).find(([, value]) => deepEqual(value, rule));
  return preset ? preset[0] : JSON.stringify(rule);
}

/**
 * domainEntry.ts の access の本体（`{ ... }` の中身）を複数行で直列化する。
 * @param {{ read?: unknown, write?: unknown, operations?: Record<string, unknown> }} access read / write / operations（管理データ操作を含む）
 * @returns {{ lines: string[], names: string[] }} lines = 1 行ずつ（インデントなし）、names = 参照したプリセット名（import に使う）
 */
export function serializeAccess(access) {
  const names = new Set();
  const lines = [];
  const base = { read: access.read, write: access.write };
  const preset = Object.entries(ACCESS_PRESETS).find(([, value]) => deepEqual(value, base));
  if (preset) {
    names.add(preset[0]);
    lines.push(`...${preset[0]},`);
  } else {
    if (access.read !== undefined) lines.push(`read: ${serializeRule(access.read)},`);
    if (access.write !== undefined) lines.push(`write: ${serializeRule(access.write)},`);
  }
  const operations = Object.entries(access.operations ?? {});
  if (operations.length > 0) {
    lines.push('operations: {');
    for (const [operation, rule] of operations) {
      const expr = serializeRule(rule);
      if (expr in PRESET_RULES) names.add(expr);
      lines.push(`  ${operation}: ${expr},`);
    }
    lines.push('},');
  }
  return { lines, names: [...names] };
}
