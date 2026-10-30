// 生成物・編集不可: pnpm extensions:generate が src/features/core/setting/extensionPoints.ts から生成する
// fields: src/features/core/setting/fields/<名前>[.<fork の名前>].ts(x) か <名前>[.<fork の名前>]/index.ts(x) の export const field(並びはファイル名の順)

import type { SettingFieldDefinition } from "@/features/core/setting/types/definition";

import { field as adminListPerPage } from "@/features/core/setting/fields/adminListPerPage";
import { field as maintenanceEnabled } from "@/features/core/setting/fields/maintenanceEnabled";
import { field as maintenanceEndAt } from "@/features/core/setting/fields/maintenanceEndAt";
import { field as maintenanceStartAt } from "@/features/core/setting/fields/maintenanceStartAt";

const fieldsMap = {
  adminListPerPage: adminListPerPage,
  maintenanceEnabled: maintenanceEnabled,
  maintenanceEndAt: maintenanceEndAt,
  maintenanceStartAt: maintenanceStartAt,
} as const satisfies Readonly<Record<string, SettingFieldDefinition>>;
export const fields = Object.assign(Object.create(null), fieldsMap) as typeof fieldsMap;
