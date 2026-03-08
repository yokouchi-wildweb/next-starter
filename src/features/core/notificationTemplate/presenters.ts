// src/features/notificationTemplate/presenters.ts

import type { NotificationTemplate } from "@/features/core/notificationTemplate/entities";
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

export type NotificationTemplateFieldPresenter = FieldPresenter<NotificationTemplate>;

export const presenters: Record<string, NotificationTemplateFieldPresenter> = {
  name: ({ value, field, record }) => formatString(value),
  title: ({ value, field, record }) => formatString(value),
  body: ({ value, field, record }) => formatString(value),
  variables: ({ value, field, record }) => formatString(value),
  category: ({ value, field, record }) => formatEnumLabel(value, { "system": "システム", "manual": "手動" }),
  createdAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
  updatedAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
};

export default presenters;

