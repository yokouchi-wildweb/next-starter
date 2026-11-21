// src/lib/firebase/serviceAccountKey.ts
//
// サービスアカウントの鍵(MY_SERVICE_ACCOUNT_KEY の JSON)を読める形に直す。firebase-admin を読まない純粋なファイル
// (サーバーの初期化 server/app.ts と、初期化に依存しない scripts/operations/storage/iam/iamGrant.ts が読む)

/**
 * JSON形式の文字列から値以外の空白・改行を取り除き、
 * 環境差異に影響されないパース可能な文字列へ正規化するユーティリティ。
 *
 * - 文字列リテラル内の空白・エスケープシーケンスは保持します。
 * - 文字列外に存在するスペース、タブ、改行などの空白文字はすべて削除します。
 * - Windows/Mac/Linux の改行コード差異（CRLF・CR）をLFへ統一します。
 * - 正規化後に JSON.parse で検証し、不正な入力は例外として通知します(文に入力の値や JSON.parse の文を含めない)。
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
  } catch {
    // JSON.parse の文は入力の一部を引用する(鍵が漏れる)ので渡さない。種類だけを言う
    throw new Error(
      'JSON文字列の正規化に失敗しました。入力が正しいJSON形式か確認してください(値は表示しません)。',
    );
  }

  return result;
}
