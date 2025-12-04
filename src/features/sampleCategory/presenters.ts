// src/features/sampleCategory/presenters.ts

import type { SampleCategory } from "@/features/sampleCategory/entities";
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

export type SampleCategoryFieldPresenter = FieldPresenter<SampleCategory>;

export const presenters: Record<string, SampleCategoryFieldPresenter> = {
  name: ({ value, field, record }) => formatString(value),
  description: ({ value, field, record }) => formatString(value),
  createdAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
  updatedAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
};

export default presenters;

