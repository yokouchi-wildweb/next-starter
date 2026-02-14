// src/features/referralReward/presenters.ts

import type { ReferralReward } from "@/features/core/referralReward/entities";
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

export type ReferralRewardFieldPresenter = FieldPresenter<ReferralReward>;

export const presenters: Record<string, ReferralRewardFieldPresenter> = {
  referral_id: ({ value, field, record }) => formatString(value),
  reward_key: ({ value, field, record }) => formatString(value),
  recipient_user_id: ({ value, field, record }) => formatString(value),
  status: ({ value, field, record }) => formatEnumLabel(value, { "pending": "保留", "fulfilled": "付与済", "failed": "失敗" }),
  fulfilled_at: ({ value, field, record }) => formatString(value),
  metadata: ({ value, field, record }) => formatString(value),
  createdAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
  updatedAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
};

export default presenters;

