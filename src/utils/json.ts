// src/utils/json.ts

/**
 * JSON形式の文字列から値以外の空白・改行を取り除き、
 * 環境差異に影響されないパース可能な文字列へ正規化するユーティリティ。
 *
 * - 文字列リテラル内の空白・エスケープシーケンスは保持します。
 * - 文字列外に存在するスペース、タブ、改行などの空白文字はすべて削除します。
 * - Windows/Mac/Linux の改行コード差異（CRLF・CR）をLFへ統一します。
 * - 正規化後に JSON.parse で検証し、不正な入力は例外として通知します。
 */
export function normalizeJsonString(raw: string): string {
  if (typeof raw !== 'string') {
    throw new TypeError('normalizeJsonString には文字列を渡してください。');
  }

  const normalizedLineEndings = raw.replace(/\r\n?/g, '\n');
  const withoutBom = normalizedLineEndings.replace(/^\uFEFF/, '');

  let result = '';
  let insideString = false;
  let isEscaped = false;

  for (let index = 0; index < withoutBom.length; index += 1) {
    const char = withoutBom[index];

    if (insideString) {
      result += char;

      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (char === '\\') {
        isEscaped = true;
        continue;
      }

      if (char === '"') {
        insideString = false;
      }

      continue;
    }

    if (char === '"') {
      insideString = true;
      result += char;
      continue;
    }

    if (char === '\\') {
      const nextChar = withoutBom[index + 1];

      if (nextChar === 'n' || nextChar === 'r' || nextChar === 't') {
        index += 1;
        continue;
      }
    }

    if (char.trim() === '') {
      continue;
    }

    result += char;
  }

  try {
    JSON.parse(result);
  } catch (error) {
    const message =
      'JSON文字列の正規化に失敗しました。入力が正しいJSON形式か確認してください。';

    if (error instanceof Error) {
      throw new Error(`${message} 原因: ${error.message}`);
    }

    throw new Error(message);
  }

  return result;
}
