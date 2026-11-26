// src/domains/core/couponHistory/couponHistoryPresenters.ts

import type { CouponHistory } from "@/domains/core/couponHistory/entities";
import type { FieldPresenter } from "@/lib/domain";
import { formatBoolean, formatNumber, formatString, formatStringArray, formatEnumLabel, formatDateValue } from "@/lib/domain";
import { formatDateJa } from "@/utils/date";

export type CouponHistoryFieldPresenter = FieldPresenter<CouponHistory>;

export const presenters: Record<string, CouponHistoryFieldPresenter> = {
  coupon_id: ({ value, field, record }) => formatString(value),
  redeemer_user_id: ({ value, field, record }) => formatString(value),
  metadata: ({ value, field, record }) => formatString(value),
  createdAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
};

export default presenters;

