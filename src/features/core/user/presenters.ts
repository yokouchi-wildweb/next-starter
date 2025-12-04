// src/features/core/user/presenters.ts

import { USER_ROLE_OPTIONS } from "@/constants/user";
import type { User } from "@/features/core/user/entities";
import { formatUserStatusLabel } from "@/features/core/user/constants/status";
import type { FieldPresenter } from "@/lib/crud/presenters";
import {
  formatDateValue,
  formatEnumLabel,
  formatString,
} from "@/lib/crud/presenters";
import { formatDateJa } from "@/utils/date";

const ROLE_LABEL_MAP = USER_ROLE_OPTIONS.reduce<Record<string, string>>((acc, option) => {
  acc[option.id] = option.name;
  return acc;
}, {});

export type UserFieldPresenter = FieldPresenter<User>;

export const presenters: Record<string, UserFieldPresenter> = {
  id: ({ value }) => formatString(value),
  providerType: ({ value }) => formatString(value),
  providerUid: ({ value }) => formatString(value),
  email: ({ value }) => formatString(value),
  displayName: ({ value }) => formatString(value),
  role: ({ value }) => formatEnumLabel(value, ROLE_LABEL_MAP),
  localPassword: ({ value }) => formatString(value),
  status: ({ value }) => formatUserStatusLabel(value as string | null | undefined, "―"),
  lastAuthenticatedAt: ({ value }) =>
    formatDateValue(value, "YYYY/MM/DD HH:mm", (val, format) =>
      formatDateJa(val, { format, fallback: null }),
    ),
  createdAt: ({ value }) =>
    formatDateValue(value, "YYYY/MM/DD HH:mm", (val, format) =>
      formatDateJa(val, { format, fallback: null }),
    ),
  updatedAt: ({ value }) =>
    formatDateValue(value, "YYYY/MM/DD HH:mm", (val, format) =>
      formatDateJa(val, { format, fallback: null }),
    ),
};

export default presenters;
