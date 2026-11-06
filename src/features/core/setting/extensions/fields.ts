// 生成物・編集不可: pnpm generate extensions が src/features/core/setting/extensionPoints.ts から生成する
// fields: src/features/core/setting/fields/<名前>.ts(x) か <名前>/index.ts(x) の export const field(並びはファイル名の順)

import type { SettingFieldDefinition } from "@/features/core/setting/types/definition";

import { field as fields_adminListPerPage } from "@/features/core/setting/fields/adminListPerPage";
import { field as fields_maintenanceEnabled } from "@/features/core/setting/fields/maintenanceEnabled";
import { field as fields_maintenanceEndAt } from "@/features/core/setting/fields/maintenanceEndAt";
import { field as fields_maintenanceStartAt } from "@/features/core/setting/fields/maintenanceStartAt";

const fieldsMap = {
  adminListPerPage: fields_adminListPerPage,
  maintenanceEnabled: fields_maintenanceEnabled,
  maintenanceEndAt: fields_maintenanceEndAt,
  maintenanceStartAt: fields_maintenanceStartAt,
} as const satisfies Readonly<Record<string, SettingFieldDefinition>>;
export const fields = Object.assign(Object.create(null), fieldsMap) as typeof fieldsMap;
