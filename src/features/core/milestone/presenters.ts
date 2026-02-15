// src/features/milestone/presenters.ts

import type { Milestone } from "@/features/core/milestone/entities";
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

export type MilestoneFieldPresenter = FieldPresenter<Milestone>;

export const presenters: Record<string, MilestoneFieldPresenter> = {
  user_id: ({ value, field, record }) => formatString(value),
  milestone_key: ({ value, field, record }) => formatString(value),
  achieved_at: ({ value, field, record }) => formatString(value),
  metadata: ({ value, field, record }) => formatString(value),
  createdAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
};

export default presenters;

