// src/domains/chatRoom/presenters.ts

import type { ChatRoom } from "@/domains/core/chatRoom/entities";
import type { FieldPresenter } from "@/lib/domain";
import { formatBoolean, formatNumber, formatString, formatStringArray, formatEnumLabel, formatDateValue } from "@/lib/domain";
import { formatDateJa } from "@/utils/date";

export type ChatRoomFieldPresenter = FieldPresenter<ChatRoom>;

export const presenters: Record<string, ChatRoomFieldPresenter> = {
  type: ({ value, field, record }) => formatString(value),
  name: ({ value, field, record }) => formatString(value),
  participants: ({ value, field, record }) => formatStringArray(value),
  participantPair: ({ value, field, record }) => formatString(value),
  readAt: ({ value, field, record }) => formatString(value),
  lastMessageSnapshot: ({ value, field, record }) => formatString(value),
  createdAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
  updatedAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
};

export default presenters;

