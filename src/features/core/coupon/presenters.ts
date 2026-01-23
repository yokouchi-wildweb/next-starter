// src/features/coupon/presenters.ts

import type { Coupon } from "@/features/core/coupon/entities";
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

export type CouponFieldPresenter = FieldPresenter<Coupon>;

export const presenters: Record<string, CouponFieldPresenter> = {
  code: ({ value, field, record }) => formatString(value),
  type: ({ value, field, record }) => formatEnumLabel(value, { "invite": "ユーザー招待", "affiliate": "アフィリエイト", "official": "公式プロモーション" }),
  status: ({ value, field, record }) => formatEnumLabel(value, { "active": "有効", "inactive": "無効" }),
  name: ({ value, field, record }) => formatString(value),
  description: ({ value, field, record }) => formatString(value),
  image_url: ({ value, field, record }) => formatString(value),
  admin_label: ({ value, field, record }) => formatString(value),
  admin_note: ({ value, field, record }) => formatString(value),
  valid_from: ({ value, field, record }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
  valid_until: ({ value, field, record }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
  max_total_uses: ({ value, field, record }) => formatNumber(value),
  max_uses_per_redeemer: ({ value, field, record }) => formatNumber(value),
  current_total_uses: ({ value, field, record }) => formatNumber(value),
  owner_id: ({ value, field, record }) => formatString(value),
  createdAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
  updatedAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
};

export default presenters;

