/**
 * 変数マップの型
 * {{VARIABLE_NAME}} 形式のプレースホルダーを置換するためのマップ
 */
export type VariableMap = Record<string, string>;

/**
 * プレースホルダー {{VARIABLE_NAME}} の形(差し込みの書式はこの 1 本だけ)
 * - 鍵は \w+(英数字と _)。点などを含む鍵は差し込まれずに残る
 */
const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * テキスト内のプレースホルダーを変数マップで置換する
 *
 * @example
 * replaceVariables("{{COMPANY_NAME}}が提供する", { COMPANY_NAME: "株式会社Example" })
 * // => "株式会社Exampleが提供する"
 */
export function replaceVariables(text: string, variables: VariableMap): string {
  return text.replace(VARIABLE_PATTERN, (match, key) => {
    return variables[key] ?? match;
  });
}

/**
 * 文字列配列内のプレースホルダーを一括置換する
 */
export function replaceVariablesInArray(
  texts: string[],
  variables: VariableMap
): string[] {
  return texts.map((text) => replaceVariables(text, variables));
}

/**
 * テキストに出てくるプレースホルダーの鍵を、出てくる順に重複なしで返す
 *
 * @example
 * listVariables("{{NAME}} 様、{{SERVICE}} です。{{NAME}}")
 * // => ["NAME", "SERVICE"]
 */
export function listVariables(text: string): string[] {
  const keys: string[] = [];
  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    if (!keys.includes(match[1])) keys.push(match[1]);
  }
  return keys;
}
