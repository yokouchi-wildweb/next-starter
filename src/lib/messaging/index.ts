// src/lib/messaging/index.ts

export {
  UPSTREAM_CHANNEL_FIELDS,
  emailFieldsSchema,
  inAppFieldsSchema,
  lineFieldsSchema,
  type ChannelFieldSchemas,
  type MessageContent,
  type MessageFieldPath,
  type UpstreamChannelFields,
} from "./definition/channels";
export { createDefineMessage, defineMessage } from "./definition/defineMessage";
export {
  MESSAGE_KINDS,
  MESSAGE_KIND_TRAITS,
  isMessageKind,
  kindTraits,
  kindsWhere,
  type MessageAdminAudience,
  type MessageKindTraits,
} from "./definition/kinds";
export type { EmailFields, MessageEmailViewModule, MessageEmailViewProps } from "./definition/emailView";
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
  adminFieldAllowedKeys,
  adminFieldCodeValue,
  applyAdminFieldValues,
  checkAdminFieldValue,
  type AdminFieldCheckOptions,
  type AdminFieldProblem,
  type AdminFieldProblemCode,
  type AdminFieldValue,
} from "./definition/adminFields";
export type {
  ChannelAddress,
  ChannelSendResult,
  ChannelSendTarget,
  ChannelWebhook,
  ChannelWebhookEvent,
  MessageAudience,
  MessageAudienceCursor,
  MessageCategory,
  MessageCategoryGroup,
  MessageChannel,
  MessageEnricher,
  MessageEnricherContext,
  MessageEvent,
  MessageEventType,
  MessageSource,
  MessageSubscriber,
} from "./receptacles/types";
