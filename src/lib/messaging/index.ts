// src/lib/messaging/index.ts

export { defineMessage } from "./definition/defineMessage";
export {
  MESSAGE_KINDS,
  MESSAGE_KIND_TRAITS,
  isMessageKind,
  kindTraits,
  kindsWhere,
  type MessageAdminTarget,
  type MessageKindTraits,
} from "./definition/kinds";
export { isSecretVar, listSecretVarKeys, secretVar } from "./definition/secret";
export { extensionPoints } from "./extensionPoints";
export {
  CHANNEL_ERROR_KINDS,
  ChannelError,
  type ChannelErrorKind,
} from "./definition/errors";
export type {
  MessageDefinitionModule,
  MessageOverrideModule,
  MessageRegistry,
  MessageRegistryEntry,
} from "./definition/registry";
export type {
  MessageDefinition,
  MessageKey,
  MessageKind,
  MessageOverride,
  MessageLayoutValuesSource,
  MessageRecord,
  MessageThrottle,
  ResolvedMessageDefinition,
} from "./definition/types";
export {
  COMMON_CONTEXT_KEYS,
  THROTTLE_CONTEXT_KEYS,
  applyMessageOverride,
  resolveMessageDefinition,
  validateMessageCategories,
  validateMessageDefinition,
  type MessageCategoryProblem,
  type OverriddenMessageDefinition,
  type MessageDefinitionProblem,
  type MessageDefinitionProblemCode,
} from "./definition/validate";
export {
  adminEditableFields,
  adminFieldAllowedKeys,
  adminFieldCodeValue,
  applyAdminFieldValues,
  checkAdminFieldValue,
  moveAdminFieldPath,
  readAdminFieldValue,
  type AdminFieldCheckOptions,
  type AdminFieldReading,
  type AdminFieldProblem,
  type AdminFieldProblemCode,
  type AdminFieldValue,
} from "./definition/adminFields";
export type {
  ChannelAddress,
  ChannelRendered,
  ChannelSendResult,
  ChannelSendTarget,
  ChannelWebhook,
  ChannelWebhookEvent,
  MessageCategory,
  MessageCategoryGroup,
  MessageChannel,
  MessageEnricher,
  MessageEnricherContext,
  MessageEnricherTarget,
  MessageLayoutEmailRenderer,
  MessageLayoutInAppRenderer,
  MessageLayoutItem,
  MessageEvent,
  MessageEventType,
  MessageSource,
  MessageSubscriber,
  MessageSystemTemplate,
} from "./receptacles/types";
export { categoryAdminLabel, enricherTargets } from "./receptacles/types";
export {
  MESSAGE_BLOCK_KIND_LABELS,
  MESSAGE_BLOCK_KINDS,
  MESSAGE_BLOCK_SCHEMAS,
  messageBlockSchema,
  messageBlocksSchema,
  type MessageBlock,
  type MessageBlockKind,
  type MessageBlocksConstraint,
} from "./layout/blocks";
export {
  fieldValueSchema,
  normalizeFieldValue,
  MESSAGE_FIELD_TYPE_LABELS,
  MESSAGE_FIELD_TYPES,
  requiredValue,
  type MessageFieldShape,
  type MessageFieldSpec,
  type MessageFieldType,
  type MessageFieldValue,
} from "./layout/vocabulary";
export {
  DEFAULT_LAYOUT_VERSION,
  defineMessageLayout,
  layoutVersionOf,
  type MessageLayout,
  type MessageLayoutFields,
  type MessageLayoutSummary,
  type MessageLayoutValues,
} from "./layout/types";
export { applyLayoutRevisions, fieldBelongsTo, fieldsForChannel, layoutValuesSchema, normalizeLayoutValues, upgradeLayoutValues } from "./layout/values";
export { resolveRendering, type MessageChannelRendering, type MessageRenderingResolution } from "./layout/rendering";
export {
  buildChannelContent,
  isMessageLayoutContent,
  type MessageChannelContentResult,
  type MessageLayoutContent,
} from "./layout/content";
// 埋め込み情報(共通の一覧・専用の宣言・一覧の検査・{{鍵}} と {{別名}} の差し込み、D111・D126)
export * from "./embedded";
