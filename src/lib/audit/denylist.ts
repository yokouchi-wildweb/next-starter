// src/lib/audit/denylist.ts

/**
 * 監査ログに残してはいけない（=漏洩リスクのある）フィールド名。
 * before / after / metadata に対して大文字小文字無視で完全一致 / suffix 一致で除外する。
 *
 * 各ドメインで追加除外したい場合は、`auditLogger.record` の前に呼び出し側で削除するか、
 * trackedFields を絞り込んでから渡すこと。
 */
const GLOBAL_DENYLIST = new Set<string>([
  "password",
  "passwordhash",
  "passwordHash",
  "localpassword",
  "localPassword",
  "token",
  "accesstoken",
  "accessToken",
  "refreshtoken",
  "refreshToken",
  "idtoken",
  "idToken",
  "secret",
  "clientsecret",
  "clientSecret",
  "apikey",
  "apiKey",
  "privatekey",
  "privateKey",
  "sessiontoken",
  "sessionToken",
  "creditcard",
  "creditCard",
  "cardnumber",
  "cardNumber",
  "cvv",
  "ssn",
]);

const SUFFIX_DENYLIST = ["_password", "_token", "_secret", "_apikey", "_key"];

/**
 * 指定フィールド名が denylist 対象か判定する。
 * - 完全一致（大文字小文字無視）
 * - 末尾一致（_password / _token / _secret / _apikey / _key）
 */
export function isDenylistedField(fieldName: string): boolean {
  const lower = fieldName.toLowerCase();
  if (GLOBAL_DENYLIST.has(fieldName) || GLOBAL_DENYLIST.has(lower)) return true;
  return SUFFIX_DENYLIST.some((suffix) => lower.endsWith(suffix));
}

/**
 * オブジェクトから denylist 対象キーを除外したコピーを返す。
 * 値の中身（ネストしたオブジェクト）は再帰的に走査せず、トップレベルのみ判定。
 * recorder では before / after を整形した直後にこれを通すこと。
 */
export function stripDenylisted<T extends Record<string, unknown>>(input: T | null | undefined): Record<string, unknown> | null {
  if (!input) return null;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    if (isDenylistedField(key)) continue;
    result[key] = input[key];
  }
  return result;
}
