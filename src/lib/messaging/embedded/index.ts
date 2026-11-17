// src/lib/messaging/embedded/index.ts — 埋め込み情報(共通の一覧・専用の宣言・一覧の検査・差し込み)。re-export だけ

export { MESSAGE_COMMON_EMBEDDED, type MessageCommonEmbedded, type MessageEmbeddedName } from "./common";
export {
  MESSAGE_EMBEDDED_TYPES,
  MESSAGE_EMBEDDED_TYPE_LABELS,
  EMBEDDED_TYPE_SUFFIX,
  displayEmbeddedValues,
  embeddedDisplayText,
  embeddedTextOf,
  embeddedTypeShape,
  embeddedValueSchema,
  embeddedValuesSchema,
  messageEmbeddedDeclarationSchema,
  type MessageEmbeddedDeclaration,
  type MessageEmbeddedType,
} from "./declaration";
export {
  checkEmbeddedCatalog,
  embeddedCatalog,
  resolveEmbeddedName,
  type MessageEmbeddedCatalog,
  type MessageEmbeddedEntry,
  type MessageEmbeddedProblem,
  type MessageEmbeddedProblemCode,
  type MessageEmbeddedSource,
} from "./catalog";
export { embeddedVariableMap, findEmbedded } from "./interpolate";
export { EMBEDDED_ALIAS_PATTERN, EMBEDDED_KEY_PATTERN } from "./names";
