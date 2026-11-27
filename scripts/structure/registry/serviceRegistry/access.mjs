// scripts/structure/registry/serviceRegistry/access.mjs
// 登録表(src/registry/serviceRegistry.ts)の行の access: 登録の entity.json からの組み方(accessOfDeclaration)と、
// プリセット名(ADMIN_ONLY 等)を使った字面への直し方(serializeAccess)。
//
// 方針:
// - read / write がプリセットと構造的に一致すればプリセットの spread(`...PUBLIC_READ`)を、一致しなければ JSON リテラルを出力する
// - 生成する登録の管理データ操作(truncateAll / export / import)は operations に必ず明示する(未指定 = none のため、生成物で意図を読めるようにする)

// src/lib/domainAccess/accessPresets.ts のプリセットの写し。
// 値の一致は scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs が TS 側を読み込んで検証する(片方だけ変えるとテストが落ちる)。
const ADMIN_RULE = { roleCategories: ['admin'] };
const ADMIN_OR_DEBUGGER_RULE = { roles: ['debugger'], roleCategories: ['admin'] };
export const ACCESS_PRESETS = {
  ADMIN_ONLY: { read: ADMIN_RULE, write: ADMIN_RULE },
  PUBLIC_READ: { read: 'public', write: ADMIN_RULE },
  ADMIN_OR_DEBUGGER: { read: ADMIN_OR_DEBUGGER_RULE, write: ADMIN_OR_DEBUGGER_RULE },
  INTERNAL_ONLY: { read: 'none', write: 'none' },
};
export const PRESET_RULES = { ADMIN_RULE, ADMIN_OR_DEBUGGER_RULE };
export const PRESET_MODULE = '@/lib/domainAccess';

// fail-closed 既定(apiAccess 未宣言の登録)。出力は ...ADMIN_ONLY になる
const FAIL_CLOSED_ACCESS = ACCESS_PRESETS.ADMIN_ONLY;

/**
 * 生成する登録の access の既定:
 * - read / write = apiAccess(無ければ ADMIN_ONLY)
 * - commands = apiAccess.commands(データ操作のコマンドの上書き、書いた時だけ)
 * - operations = apiAccess.operations + 管理データ操作: truncateAll は管理者、export / import は useImportExport が true のときだけ管理者(書かなければ "none" = 閉じる)
 */
export function buildGeneratedAccess(entity) {
  const apiAccess = entity?.apiAccess ?? null;
  const base = apiAccess ? { read: apiAccess.read, write: apiAccess.write } : FAIL_CLOSED_ACCESS;
  const dataRule = entity?.useImportExport === true ? ADMIN_RULE : 'none';
  return {
    ...base,
    operations: {
      ...(apiAccess?.operations ?? {}),
      truncateAll: ADMIN_RULE,
      export: dataRule,
      import: dataRule,
    },
    // データ操作のコマンド(pnpm ops data)の上書き。書いた登録だけ出す(src/lib/domain/README.md)
    ...(apiAccess?.commands ? { commands: apiAccess.commands } : {}),
  };
}

/**
 * 登録の access(登録表に載る値): 手で持つ登録(generate:false)は apiAccess をそのまま(動いている値を全部書く)。
 * 生成する登録は buildGeneratedAccess の既定に、apiAccess.operations の書いた鍵を重ねる(書いた鍵が勝つ)。
 * apiAccess の無い手で持つ登録は閉じた既定: read / write は ADMIN_ONLY、管理データ操作(truncateAll / export / import)は全部 "none"
 * (生成の既定は重ねない。開くなら apiAccess.operations に書く、src/lib/domain/README.md の access)
 * @param {Record<string, any>} entity 登録の entity.json
 */
export function accessOfDeclaration(entity) {
  if (entity.generate === false) {
    if (entity.apiAccess) return structuredClone(entity.apiAccess);
    return { ...structuredClone(FAIL_CLOSED_ACCESS), operations: { truncateAll: "none", export: "none", import: "none" } };
  }
  const generated = buildGeneratedAccess(entity);
  const written = entity.apiAccess?.operations ?? {};
  return { ...generated, operations: { ...generated.operations, ...written } };
}

// キー順を問わない構造比較(配列は順序込み)
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
 * access の本体(`{ ... }` の中身)を複数行で直列化する。
 * @param {{ read?: unknown, write?: unknown, operations?: Record<string, unknown>, commands?: Record<string, string> }} access read / write / operations(管理データ操作を含む)/ commands(データ操作のコマンドの上書き)
 * @returns {{ lines: string[], names: string[] }} lines = 1 行ずつ(インデントなし)、names = 参照したプリセット名(import に使う)
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
  const commands = Object.entries(access.commands ?? {});
  if (commands.length > 0) {
    lines.push('commands: {');
    for (const [command, value] of commands) lines.push(`  ${command}: ${JSON.stringify(value)},`);
    lines.push('},');
  }
  // read / write / operations / commands 以外の鍵(手で持つ登録の apiAccess に書いた物)は JSON のまま
  for (const [key, value] of Object.entries(access)) {
    if (!['read', 'write', 'operations', 'commands'].includes(key)) lines.push(`${key}: ${JSON.stringify(value)},`);
  }
  return { lines, names: [...names] };
}
