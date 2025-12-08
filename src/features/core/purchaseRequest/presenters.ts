// src/features/purchaseRequest/presenters.ts

import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities";
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

export type PurchaseRequestFieldPresenter = FieldPresenter<PurchaseRequest>;

export const presenters: Record<string, PurchaseRequestFieldPresenter> = {
  idempotency_key: ({ value, field, record }) => formatString(value),
  wallet_type: ({ value, field, record }) => formatEnumLabel(value, { "regular_point": "通常ポイント", "temporary_point": "期間限定ポイント", "regular_coin": "通常コイン" }),
  amount: ({ value, field, record }) => formatNumber(value),
  payment_amount: ({ value, field, record }) => formatNumber(value),
  payment_method: ({ value, field, record }) => formatString(value),
  status: ({ value, field, record }) => formatEnumLabel(value, { "pending": "処理待ち", "processing": "処理中", "completed": "完了", "failed": "失敗", "expired": "期限切れ" }),
  payment_provider: ({ value, field, record }) => formatString(value),
  payment_session_id: ({ value, field, record }) => formatString(value),
  redirect_url: ({ value, field, record }) => formatString(value),
  error_code: ({ value, field, record }) => formatString(value),
  error_message: ({ value, field, record }) => formatString(value),
  completed_at: ({ value, field, record }) => formatString(value),
  expires_at: ({ value, field, record }) => formatString(value),
  createdAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
  updatedAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
};

export default presenters;

