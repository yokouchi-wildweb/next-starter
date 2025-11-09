// src/features/setting/services/server/settingService.ts
import type { Setting } from "@/features/setting/entities";
import { base } from "./drizzleBase";

const DEFAULT_ADMIN_LIST_PER_PAGE = 100;

const DEFAULT_SETTING_VALUES = {
  developerMotivation: 100,
  adminHeaderLogoImageUrl: null,
  adminHeaderLogoImageDarkUrl: null,
  adminListPerPage: DEFAULT_ADMIN_LIST_PER_PAGE,
} as const;

async function getGlobalSetting(): Promise<Setting> {
  const existing = (await base.get("global")) as Setting | undefined;

  if (!existing) {
    return (await base.upsert({
      id: "global",
      ...DEFAULT_SETTING_VALUES,
    })) as Setting;
  }

  return {
    ...existing,
    adminHeaderLogoImageUrl: existing.adminHeaderLogoImageUrl ?? null,
    adminHeaderLogoImageDarkUrl: existing.adminHeaderLogoImageDarkUrl ?? null,
    adminListPerPage:
      existing.adminListPerPage ?? DEFAULT_SETTING_VALUES.adminListPerPage,
  };
}

async function getAdminListPerPage(): Promise<number> {
  const setting = await getGlobalSetting();
  return setting.adminListPerPage;
}

export const settingService = {
  ...base,
  getGlobalSetting,
  getAdminListPerPage,
  DEFAULT_ADMIN_LIST_PER_PAGE,
};
