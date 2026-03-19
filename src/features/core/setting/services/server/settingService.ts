// src/features/setting/services/server/settingService.ts
import type { Setting } from "@/features/core/setting/entities";
import type { User } from "@/features/core/user/entities";
import { createAdmin } from "@/features/core/user/services/server/creation/console";
import { getZodDefaults } from "@/lib/zod";

import { settingExtendedSchema } from "../../setting.extended";
import type { SettingExtended } from "../../setting.extended";
import type { AdminSetupInput } from "../types";
import { base } from "./drizzleBase";

const DEFAULT_ADMIN_LIST_PER_PAGE = 50;

/**
 * DBの行データ（extended jsonb を含む）をフラットな Setting 型に変換する
 */
function flattenSettingRow(
  row: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Setting {
  const { extended, ...baseFields } = row;
  const extendedData = settingExtendedSchema.safeParse({
    ...defaults,
    ...(extended as Record<string, unknown> | null),
  });

  return {
    ...baseFields,
    ...(extendedData.success ? extendedData.data : defaults),
  } as Setting;
}

const createDefaultSettingValues = (): Record<string, unknown> => ({
  // 基本設定項目
  adminListPerPage: DEFAULT_ADMIN_LIST_PER_PAGE,
  // 拡張設定項目（setting.extended.ts から自動取得）
  ...getZodDefaults(settingExtendedSchema),
});

async function getGlobalSetting(): Promise<Setting> {
  const existing = await base.get("global");
  const defaultValues = createDefaultSettingValues();

  if (!existing) {
    return {
      id: "global",
      createdAt: null,
      updatedAt: null,
      ...defaultValues,
    } as Setting;
  }

  const setting = flattenSettingRow(
    existing as unknown as Record<string, unknown>,
    defaultValues,
  );

  return {
    ...setting,
    adminListPerPage: setting.adminListPerPage ?? DEFAULT_ADMIN_LIST_PER_PAGE,
  };
}

async function getAdminListPerPage(): Promise<number> {
  const setting = await getGlobalSetting();
  return setting.adminListPerPage;
}

export async function initializeAdminSetup(data: AdminSetupInput): Promise<User> {
  const user = await createAdmin(data);
  const defaultValues = createDefaultSettingValues();
  const existing = await base.get("global");

  const createData = { id: "global", ...defaultValues } as Parameters<typeof base.create>[0];
  if (!existing) {
    await base.create(createData);
  } else {
    await base.update("global", defaultValues as Parameters<typeof base.update>[1]);
  }

  return user;
}

export const settingService = {
  ...base,
  get: async (_id: string) => getGlobalSetting(),
  getGlobalSetting,
  getAdminListPerPage,
  DEFAULT_ADMIN_LIST_PER_PAGE,
  initializeAdminSetup,
};
