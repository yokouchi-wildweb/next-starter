/**
 * 変数マップの型
 * {{VARIABLE_NAME}} 形式のプレースホルダーを置換するためのマップ
 */
export type VariableMap = Record<string, string>;

/**
 * テキスト内のプレースホルダーを変数マップで置換する
 *
 * @example
 * replaceVariables("{{COMPANY_NAME}}が提供する", { COMPANY_NAME: "株式会社Example" })
 * // => "株式会社Exampleが提供する"
 */
export function replaceVariables(text: string, variables: VariableMap): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
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
