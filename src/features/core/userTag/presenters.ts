// src/features/userTag/presenters.ts

import type { UserTag } from "@/features/core/userTag/entities";
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
import { createElement } from "react";
import { getTagColorStyle } from "./constants/colors";
import { UserTagColorOptions } from "./constants/field";

export type UserTagFieldPresenter = FieldPresenter<UserTag>;

const colorLabelMap = Object.fromEntries(
  UserTagColorOptions.map((o) => [o.value, o.label]),
);

export const presenters: Record<string, UserTagFieldPresenter> = {
  name: ({ value, field, record }) => formatString(value),
  color: ({ value }) => {
    if (!value) return "―";
    const style = getTagColorStyle(value as string);
    const label = colorLabelMap[value as string] ?? String(value);
    if (!style) return label;
    return createElement("span", { className: "inline-flex items-center gap-1.5" },
      createElement("span", { className: `inline-block size-3 rounded-full ${style.bg}` }),
      label,
    );
  },
  description: ({ value, field, record }) => formatString(value),
  createdAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
  updatedAt: ({ value }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
};

export default presenters;

