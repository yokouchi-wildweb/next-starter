// src/features/__domain__/presenters.ts

import type { __Domain__ } from "@/features/__domain__/entities";
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

export type __Domain__FieldPresenter = FieldPresenter<__Domain__>;

export const presenters: Record<string, __Domain__FieldPresenter> = {
__PRESENTERS_BODY__
};

export default presenters;
