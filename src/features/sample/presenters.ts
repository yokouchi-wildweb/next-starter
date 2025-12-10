// src/features/sample/presenters.ts

import type { Sample } from "@/features/sample/entities";
import type { FieldPresenter } from "@/lib/crud/presenters";
import {
  formatBoolean,
  formatNumber,
  formatString,
  formatStringArray,
  formatEnumLabel,
  formatDateValue,
} from "@/lib/crud/presenters";
import { formatDateJa } from "@/utils/date";

export type SampleFieldPresenter = FieldPresenter<Sample>;

export const presenters: Record<string, SampleFieldPresenter> = {
  name: ({ value, field, record }) => formatString(value),
  number: ({ value, field, record }) => formatNumber(value),
  rich_number: ({ value, field, record }) => formatNumber(value),
  switch: ({ value, field, record }) => formatBoolean(value, "はい", "いいえ"),
  radio: ({ value, field, record }) => formatBoolean(value, "はい", "いいえ"),
  select: ({ value, field, record }) => formatEnumLabel(value, { "apple": "りんご", "orange": "オレンジ", "berry": "いちご" }),
  multi_select: ({ value, field, record }) => formatStringArray(value),
  sale_start_at: ({ value, field, record }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
  date: ({ value, field, record }) => formatDateValue(value, "YYYY/MM/DD", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
  time: ({ value, field, record }) => formatString(value),
  description: ({ value, field, record }) => formatString(value),
  createdAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
  updatedAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
};

export default presenters;

