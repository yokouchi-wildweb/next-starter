// src/features/notification/presenters.ts

import type { Notification } from "@/features/core/notification/entities";
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

export type NotificationFieldPresenter = FieldPresenter<Notification>;

export const presenters: Record<string, NotificationFieldPresenter> = {
  title: ({ value, field, record }) => formatString(value),
  body: ({ value, field, record }) => formatString(value),
  target_type: ({ value, field, record }) => formatEnumLabel(value, { "all": "全員", "role": "ロール指定", "individual": "個別指定" }),
  target_user_ids: ({ value, field, record }) => formatStringArray(value),
  target_roles: ({ value, field, record }) => formatStringArray(value),
  sender_type: ({ value, field, record }) => formatEnumLabel(value, { "admin": "管理者", "system": "システム" }),
  created_by_id: ({ value, field, record }) => formatString(value),
  published_at: ({ value, field, record }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
  createdAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
  updatedAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
};

export default presenters;

