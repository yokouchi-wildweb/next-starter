// src/lib/messaging/vars/index.ts — 埋め込み情報(共通の一覧・専用の宣言・一覧の検査・差し込み)。re-export だけ

export { MESSAGE_COMMON_VARS, type MessageCommonVar, type MessageNamedVar } from "./common";
export {
  MESSAGE_VAR_TYPES,
  MESSAGE_VAR_TYPE_LABELS,
  VAR_TYPE_SUFFIX,
  displayVarValues,
  varDisplayText,
  varTextOf,
  varTypeShape,
  varValueSchema,
  varValuesSchema,
  messageVarDeclarationSchema,
  type MessageVarDeclaration,
  type MessageVarType,
} from "./declaration";
export {
  checkVarCatalog,
  varCatalog,
  resolveVarName,
  type MessageVarCatalog,
  type MessageVarEntry,
  type MessageVarProblem,
  type MessageVarProblemCode,
  type MessageVarSource,
} from "./catalog";
export { varMap, findVar } from "./interpolate";
export { VAR_ALIAS_PATTERN, VAR_KEY_PATTERN } from "./names";
