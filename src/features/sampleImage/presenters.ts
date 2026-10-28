// src/features/sampleImage/presenters.ts

import type { SampleImage } from "@/features/sampleImage/entities";
import type { FieldPresenter } from "@/lib/crud";
import {
  formatBoolean,
  formatNumber,
  formatString,
  formatStringArray,
  formatEnumLabel,
  formatDateValue,
  formatMediaThumbnail,
  formatMediaThumbnails,
} from "@/lib/crud";
import { formatDateJa } from "@/utils/date";

export type SampleImageFieldPresenter = FieldPresenter<SampleImage>;

export const presenters: Record<string, SampleImageFieldPresenter> = {
  file: ({ value, field, record }) => formatMediaThumbnail(value),
  sort_order: ({ value, field, record }) => formatString(value),
  createdAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
  updatedAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
};

export default presenters;

