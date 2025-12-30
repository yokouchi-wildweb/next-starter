// src/features/foo/presenters.ts

import type { Foo } from "@/features/foo/entities";
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

export type FooFieldPresenter = FieldPresenter<Foo>;

export const presenters: Record<string, FooFieldPresenter> = {
  name: ({ value, field, record }) => formatString(value),
  type: ({ value, field, record }) => formatEnumLabel(value, { "apple": "apple", "orange": "orange" }),
  num: ({ value, field, record }) => formatNumber(value),
  createdAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
  updatedAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
};

export default presenters;

