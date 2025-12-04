// src/features/core/walletHistory/presenters.ts

import type { WalletHistory } from "@/features/core/walletHistory/entities";
import type { FieldPresenter } from "@/lib/crud/presenters";
import {
  formatBoolean,
  formatEnumLabel,
  formatNumber,
  formatString,
  formatStringArray,
  formatDateValue,
} from "@/lib/crud/presenters";
import { formatDateJa } from "@/utils/date";

type WalletHistoryFieldPresenter = FieldPresenter<WalletHistory>;

export const presenters: Record<string, WalletHistoryFieldPresenter> = {
  type: ({ value }) => formatString(value),
  change_method: ({ value }) => formatString(value),
  points_delta: ({ value }) => formatNumber(value),
  balance_before: ({ value }) => formatNumber(value),
  balance_after: ({ value }) => formatNumber(value),
  source_type: ({ value }) => formatString(value),
  request_batch_id: ({ value }) => formatString(value),
  reason: ({ value }) => formatString(value),
  createdAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
  user_id: ({ value }) => formatString(value),
};

export default presenters;
