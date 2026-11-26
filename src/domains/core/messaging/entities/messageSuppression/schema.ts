// src/domains/core/messaging/entities/messageSuppression/schema.ts

/** 宛先の停止の理由（message_suppressions.reason） */
export const MESSAGE_SUPPRESSION_REASONS = [
  "hard_bounce",
  "complaint",
  "one_click",
  "manual",
] as const;
