// src/features/setting/services/server/settingService.ts
import type { Setting } from "@/features/core/setting/entities";
import type { User } from "@/features/core/user/entities";
import { createAdmin } from "@/features/core/user/services/server/creation/console";

import type { AdminSetupInput } from "../types";
import { base } from "./drizzleBase";
import { extendedDefaultSettingValues } from "./settingDefaults.extended";

const DEFAULT_ADMIN_LIST_PER_PAGE = 50;

const createDefaultSettingValues = () => ({
  // 基本設定項目
  adminHeaderLogoImageUrl: null,
  adminHeaderLogoImageDarkUrl: null,
  adminListPerPage: DEFAULT_ADMIN_LIST_PER_PAGE,
  // 拡張設定項目（setting-fields.json から生成）
  ...extendedDefaultSettingValues,
});

async function getGlobalSetting(): Promise<Setting> {
  const existing = (await base.get("global")) as Setting | undefined;
  const defaultValues = createDefaultSettingValues();

  if (!existing) {
    return {
      id: "global",
      createdAt: null,
      updatedAt: null,
      ...defaultValues,
    };
  }

  return {
    ...existing,
    adminHeaderLogoImageUrl: existing.adminHeaderLogoImageUrl ?? null,
    adminHeaderLogoImageDarkUrl: existing.adminHeaderLogoImageDarkUrl ?? null,
    adminListPerPage: existing.adminListPerPage ?? defaultValues.adminListPerPage,
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

  if (!existing) {
    await base.create({
      id: "global",
      ...defaultValues,
    });
  } else {
    await base.update("global", defaultValues);
  }

  return user;
}

export const settingService = {
  ...base,
  getGlobalSetting,
  getAdminListPerPage,
  DEFAULT_ADMIN_LIST_PER_PAGE,
  initializeAdminSetup,
};
