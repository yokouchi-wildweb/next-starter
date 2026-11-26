// src/domains/core/user/userPresenters.ts

import { getAllRoleOptions, formatUserStatusLabel } from "@/domains/core/user/constants";
import type { User } from "@/domains/core/user/entities";
import type { FieldPresenter } from "@/lib/domain";
import { formatDateValue, formatEnumLabel, formatString } from "@/lib/domain";
import { formatDateJa } from "@/utils/date";

const ROLE_LABEL_MAP = getAllRoleOptions().reduce<Record<string, string>>((acc, option) => {
  acc[option.id] = option.name;
  return acc;
}, {});

export type UserFieldPresenter = FieldPresenter<User>;

export const presenters: Record<string, UserFieldPresenter> = {
  id: ({ value }) => formatString(value),
  providerType: ({ value }) => formatString(value),
  providerUid: ({ value }) => formatString(value),
  email: ({ value }) => formatString(value),
  name: ({ value }) => formatString(value),
  role: ({ value }) => formatEnumLabel(value, ROLE_LABEL_MAP),
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
