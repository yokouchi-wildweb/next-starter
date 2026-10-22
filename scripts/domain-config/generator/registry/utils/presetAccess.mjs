// serviceRegistry の access をプリセット名（ADMIN_ONLY 等）で出力し、プリセットの import を使用中の名前に揃えるヘルパー。
//
// 方針:
// - access がプリセットと構造的に一致すればプリセット名を、一致しなければ JSON リテラルを出力する（中身は等価）
// - import の整理は `@/config/app/domain-api-access.config` からの import 行 1 行だけを対象にする
// - 集合が変わらなければ import 行に触れない（整形の違いで再生成のたびに差分を出さない）

// src/config/app/domain-api-access.config.ts のプリセットの写し。
// 値の一致は registry.test.mjs が TS 側を読み込んで検証する（片方だけ変えるとテストが落ちる）。
const ADMIN_OR_DEBUGGER_RULE = { roles: ['debugger'], roleCategories: ['admin'] };
export const ACCESS_PRESETS = {
  ADMIN_ONLY: { read: { roleCategories: ['admin'] }, write: { roleCategories: ['admin'] } },
  PUBLIC_READ: { read: 'public', write: { roleCategories: ['admin'] } },
  ADMIN_OR_DEBUGGER: { read: ADMIN_OR_DEBUGGER_RULE, write: ADMIN_OR_DEBUGGER_RULE },
};
export const PRESET_RULES = { ADMIN_OR_DEBUGGER_RULE };

// import を管理する名前（access 全体のプリセット + operations 上書き等で手書きされうる単一ルール）
const KNOWN_NAMES = [...Object.keys(ACCESS_PRESETS), ...Object.keys(PRESET_RULES)];
const PRESET_MODULE = '@/config/app/domain-api-access.config';
const IMPORT_PATTERN = /^import\s*\{([^}]*)\}\s*from\s*["']@\/config\/app\/domain-api-access\.config["'];?[ \t]*(?:\r?\n|$)/m;

// キー順を問わない構造比較（配列は順序込み）
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]));
}

/**
 * access を 1 行の TS 式として直列化する。プリセットと一致すればプリセット名、無ければ JSON リテラル
 * （JSON は有効な TS オブジェクトリテラル）。
 */
export function serializeAccess(access) {
  const preset = Object.entries(ACCESS_PRESETS).find(([, value]) => deepEqual(value, access));
  return preset ? preset[0] : JSON.stringify(access);
}

// 文字列は空文字列に、コメントは空にして、識別子の使用判定から外す（ヘッダーコメントのプリセット名を数えない）
function stripStringsAndComments(text) {
  return text.replace(
    /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    (match, str) => (str ? '""' : ''),
  );
}

// `X` / `X as Y` / `type X` の指定子から、ファイル内で使われるローカル名を取り出す
function localNameOf(specifier) {
  return specifier.split(/\s+/).at(-1);
}

/**
 * プリセットの import 行を、ファイル内で実際に使われている名前だけに揃える。
 * - 使用中の名前が無ければ import 行を消し、必要なのに import 行が無ければ追加する
 * - 既存の名前の並びは保ち、新しく要る名前は末尾に足す
 * - fork が手で足した名前（既知のプリセット以外）も、使われている限り残す
 * @param {string} text ファイル全体
 * @returns {string} 更新後のファイル全体（変更が無ければ text そのもの）
 */
export function syncPresetImport(text) {
  const match = IMPORT_PATTERN.exec(text);
  const existing = match
    ? match[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const body = stripStringsAndComments(match ? text.slice(0, match.index) + text.slice(match.index + match[0].length) : text);
  const isUsed = (name) => new RegExp(`(?<![\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(body);

  const kept = existing.filter((specifier) => isUsed(localNameOf(specifier)));
  const keptNames = new Set(kept.map(localNameOf));
  const added = KNOWN_NAMES.filter((name) => !keptNames.has(name) && isUsed(name));
  const next = [...kept, ...added];

  if (next.length === existing.length && next.every((s, i) => s === existing[i])) return text;

  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const line = next.length > 0 ? `import { ${next.join(', ')} } from "${PRESET_MODULE}";${newline}` : '';
  if (match) {
    return text.slice(0, match.index) + line + text.slice(match.index + match[0].length);
  }
  // 型 import（@/lib/domain/types）の直後、無ければ最初の import の前（import が無ければ先頭）に置く
  const typesImport = /^import[^\n]*from\s*["']@\/lib\/domain\/types["'];?[ \t]*(?:\r?\n|$)/m.exec(text);
  if (typesImport) {
    const at = typesImport.index + typesImport[0].length;
    const sep = /\n$/.test(typesImport[0]) ? '' : newline;
    return text.slice(0, at) + sep + line + text.slice(at);
  }
  const firstImport = /^import\b/m.exec(text);
  const at = firstImport ? firstImport.index : 0;
  return text.slice(0, at) + line + text.slice(at);
}

/**
 * レジストリに書かれた access 式（プリセット名・JSON リテラル・手書きの TS オブジェクト）を評価する。
 * 使えるのはプリセット名と単一ルール名だけ。fork 独自の定数など他の識別子を含むと評価できず null を返す。
 * 評価するのはリポジトリ内のレジストリファイルの式だけ（生成 CLI 内でのみ使う）。
 * @param {string} expr access の値の式
 * @returns {unknown | null}
 */
export function evaluateAccessExpression(expr) {
  const scope = { ...ACCESS_PRESETS, ...PRESET_RULES };
  try {
    return new Function(...Object.keys(scope), `"use strict"; return (${expr});`)(...Object.values(scope));
  } catch {
    return null;
  }
}

/**
 * 既存の access 式を新しい access で置き換えるとき、値（中身）が変わるかを判定する。
 * 書き方だけの違い（複数行 → 1 行、JSON → プリセット名など）は変化とみなさない。
 * @param {string} oldExpr 既存の access の値の式
 * @param {unknown} newAccess 新しい access
 * @returns {string | null} 値が変わる（または比較できない）ときは警告文、同じなら null
 */
export function describeAccessChange(oldExpr, newAccess) {
  const next = serializeAccess(newAccess);
  if (oldExpr.trim() === next) return null;
  const previous = evaluateAccessExpression(oldExpr);
  if (previous !== null && deepEqual(previous, newAccess)) return null;
  const compact = oldExpr.replace(/\s+/g, ' ').trim();
  const note = previous === null ? '（既存の式を評価できないため値を比較できません）' : '';
  return `access が変わります${note}: ${compact} → ${next}`;
}
