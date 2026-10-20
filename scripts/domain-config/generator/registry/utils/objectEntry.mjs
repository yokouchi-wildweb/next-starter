// レジストリファイル内のオブジェクトリテラル（例: `export const serviceRegistry = { ... }`）の
// 直下エントリを、1 行でも複数行（Prettier 整形済み等）でも丸ごと置換・追加するためのヘルパー。
//
// 方針:
// - 探すのはオブジェクト直下のキーだけ（入れ子のキーや、オブジェクト外の同名行には触れない）
// - AUTO-GENERATED ブロック外に置かれた既存エントリも、直下のキーなら置換する（旧フォークの互換）
// - 見つからなければ AUTO-GENERATED-END の直前（無ければ閉じ括弧の行の直前）に追加する

const END_MARKER = "// --- AUTO-GENERATED-END ---";

function isIdentChar(ch) {
  return /[A-Za-z0-9_$]/.test(ch);
}

// 文字列・コメントを読み飛ばす。読み飛ばした場合は次の位置、対象外なら -1 を返す。
function skipStringOrComment(text, i) {
  const ch = text[i];
  if (ch === "/" && text[i + 1] === "/") {
    const nl = text.indexOf("\n", i);
    return nl === -1 ? text.length : nl;
  }
  if (ch === "/" && text[i + 1] === "*") {
    const close = text.indexOf("*/", i + 2);
    return close === -1 ? text.length : close + 2;
  }
  if (ch === '"' || ch === "'" || ch === "`") {
    let j = i + 1;
    while (j < text.length && text[j] !== ch) {
      if (text[j] === "\\") j++;
      j++;
    }
    return j + 1;
  }
  return -1;
}

// `const <objectName> ... = {` の `{` の位置を返す。
function findObjectOpen(text, objectName) {
  const match = new RegExp(`const\\s+${objectName}\\b[^=]*=\\s*\\{`).exec(text);
  return match ? match.index + match[0].length - 1 : -1;
}

/**
 * オブジェクト直下のエントリを走査する。
 * @returns {{ entries: { key: string, start: number, end: number }[], close: number }}
 *   start = キーの位置、end = 区切りの `,` の直後（末尾エントリで `,` が無い場合は値の直後）、close = 閉じ `}` の位置
 */
export function scanObjectEntries(text, objectName) {
  const open = findObjectOpen(text, objectName);
  if (open === -1) {
    throw new Error(`${objectName} のオブジェクトリテラルが見つかりません`);
  }
  const entries = [];
  let depth = 1;
  let expectKey = true;
  let current = null;
  let lastValueEnd = open + 1;

  for (let i = open + 1; i < text.length; ) {
    const skipped = skipStringOrComment(text, i);
    if (skipped !== -1) {
      // 直下でキー待ちの間の文字列はクォート付きキー
      if (depth === 1 && expectKey && text[i] !== "/") {
        const rest = text.slice(skipped).match(/^\s*:/);
        if (rest) {
          current = { key: text.slice(i + 1, skipped - 1), start: i };
        }
        expectKey = false;
      }
      if (text[i] !== "/") lastValueEnd = skipped;
      i = skipped;
      continue;
    }
    const ch = text[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (depth === 1 && expectKey) {
      expectKey = false;
      if (isIdentChar(ch)) {
        let j = i;
        while (j < text.length && isIdentChar(text[j])) j++;
        if (/^\s*:/.test(text.slice(j))) {
          current = { key: text.slice(i, j), start: i };
        }
        lastValueEnd = j;
        i = j;
        continue;
      }
    }
    if (ch === "{" || ch === "[" || ch === "(") {
      depth++;
    } else if (ch === "}" || ch === "]" || ch === ")") {
      depth--;
      if (depth === 0) {
        if (current) entries.push({ ...current, end: lastValueEnd });
        return { entries, close: i };
      }
    } else if (ch === "," && depth === 1) {
      if (current) entries.push({ ...current, end: i + 1 });
      current = null;
      expectKey = true;
      i++;
      continue;
    }
    lastValueEnd = i + 1;
    i++;
  }
  throw new Error(`${objectName} の閉じ括弧が見つかりません`);
}

function lineStartOf(text, index) {
  return text.lastIndexOf("\n", index - 1) + 1;
}

/**
 * オブジェクト直下の `key` エントリを `key: value,` に置換する。無ければ追加する。
 * @param {string} text ファイル全体
 * @param {{ objectName: string, key: string, value: string, indent?: string }} options
 * @returns {string} 更新後のファイル全体
 */
export function upsertObjectEntry(text, { objectName, key, value, indent = "  " }) {
  const { entries, close } = scanObjectEntries(text, objectName);
  const entry = `${key}: ${value},`;
  const existing = entries.find((e) => e.key === key);

  if (existing) {
    return text.slice(0, existing.start) + entry + text.slice(existing.end);
  }

  const markerIndex = text.indexOf(END_MARKER);
  const insertAt =
    markerIndex !== -1 && markerIndex < close ? lineStartOf(text, markerIndex) : lineStartOf(text, close);
  const inserted = text.slice(0, insertAt) + `${indent}${entry}\n` + text.slice(insertAt);
  // 追加位置の直前のエントリが末尾カンマ無しなら補う（無いと構文エラーになる）
  const previous = entries.filter((e) => e.end <= insertAt).at(-1);
  if (previous && text[previous.end - 1] !== ",") {
    return inserted.slice(0, previous.end) + "," + inserted.slice(previous.end);
  }
  return inserted;
}
