// src/lib/templateVariables/index.ts
//
// 入口 ".": テキストの差し込み {{VARIABLE_NAME}}(書式はこの 1 本だけ)。依存なしの純関数。中身: ./README.md

export type { VariableMap } from "./variables";
export { listVariables, replaceVariables, replaceVariablesInArray } from "./variables";
