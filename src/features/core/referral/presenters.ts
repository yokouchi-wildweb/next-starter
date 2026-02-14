// src/features/referral/presenters.ts

import type { Referral } from "@/features/core/referral/entities";
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

export type ReferralFieldPresenter = FieldPresenter<Referral>;

export const presenters: Record<string, ReferralFieldPresenter> = {
  coupon_id: ({ value, field, record }) => formatString(value),
  inviter_user_id: ({ value, field, record }) => formatString(value),
  invitee_user_id: ({ value, field, record }) => formatString(value),
  status: ({ value, field, record }) => formatEnumLabel(value, { "active": "有効", "cancelled": "取消" }),
  createdAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
  updatedAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
};

export default presenters;

