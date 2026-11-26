// src/domains/core/milestone/milestonePresenters.ts

import type { Milestone } from "@/domains/core/milestone/entities";
import type { FieldPresenter } from "@/lib/domain";
import { formatBoolean, formatNumber, formatString, formatStringArray, formatEnumLabel, formatDateValue } from "@/lib/domain";
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

