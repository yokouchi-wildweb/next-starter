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
export {
  createDefineMessage,
  defineMessage,
  defineMessageOverride,
} from "./definition/defineMessage";
export {
  CHANNEL_ERROR_KINDS,
  ChannelError,
  type ChannelErrorKind,
} from "./definition/errors";
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
  validateMessageDefinition,
  type MessageDefinitionProblem,
  type MessageDefinitionProblemCode,
} from "./definition/validate";
