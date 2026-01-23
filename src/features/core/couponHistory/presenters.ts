// src/features/couponHistory/presenters.ts

import type { CouponHistory } from "@/features/core/couponHistory/entities";
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

export type CouponHistoryFieldPresenter = FieldPresenter<CouponHistory>;

export const presenters: Record<string, CouponHistoryFieldPresenter> = {
  coupon_id: ({ value, field, record }) => formatString(value),
  redeemer_id: ({ value, field, record }) => formatString(value),
  metadata: ({ value, field, record }) => formatString(value),
  createdAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
};

export default presenters;

