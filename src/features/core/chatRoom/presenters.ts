// src/features/chatRoom/presenters.ts

import type { ChatRoom } from "@/features/core/chatRoom/entities";
import type { FieldPresenter } from "@/lib/crud";
import {
  formatBoolean,
  formatNumber,
  formatString,
  formatStringArray,
  formatEnumLabel,
  formatDateValue,
} from "@/lib/crud";
import { formatDateJa } from "@/utils/date";

export type ChatRoomFieldPresenter = FieldPresenter<ChatRoom>;

export const presenters: Record<string, ChatRoomFieldPresenter> = {
  type: ({ value, field, record }) => formatString(value),
  name: ({ value, field, record }) => formatString(value),
  participants: ({ value, field, record }) => formatStringArray(value),
  participant_pair: ({ value, field, record }) => formatString(value),
  read_at: ({ value, field, record }) => formatString(value),
  last_message_snapshot: ({ value, field, record }) => formatString(value),
  createdAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
  updatedAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
};

export default presenters;

