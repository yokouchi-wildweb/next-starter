// src/domains/__domain__/__domain__Presenters.ts

import type { __Domain__ } from "@/domains/__domain__/entities";
import type { FieldPresenter } from "@/lib/domain";
import {
  formatBoolean,
  formatNumber,
  formatString,
  formatStringArray,
  formatEnumLabel,
  formatDateValue,
} from "@/lib/domain";
import {
  formatMediaThumbnail,
  formatMediaThumbnails,
} from "@/lib/crud";
import { formatDateJa } from "@/utils/date";

export type __Domain__FieldPresenter = FieldPresenter<__Domain__>;

export const presenters: Record<string, __Domain__FieldPresenter> = {
__PRESENTERS_BODY__
};

export default presenters;
