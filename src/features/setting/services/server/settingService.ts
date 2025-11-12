// src/features/setting/services/server/settingService.ts
import type { Setting } from "@/features/setting/entities";
import { base } from "./drizzleBase";

const DEFAULT_ADMIN_LIST_PER_PAGE = 100;

const createDefaultSettingValues = () => ({
  adminHeaderLogoImageUrl: null,
  adminHeaderLogoImageDarkUrl: null,
  adminListPerPage: DEFAULT_ADMIN_LIST_PER_PAGE,
  adminFooterText: `© ${new Date().getFullYear()} ORIPA DO!`,
});

async function getGlobalSetting(): Promise<Setting> {
  const existing = (await base.get("global")) as Setting | undefined;
  const defaultValues = createDefaultSettingValues();

  if (!existing) {
    return (await base.upsert({
      id: "global",
      ...defaultValues,
    })) as Setting;
  }

  return {
    ...existing,
    adminHeaderLogoImageUrl: existing.adminHeaderLogoImageUrl ?? null,
    adminHeaderLogoImageDarkUrl: existing.adminHeaderLogoImageDarkUrl ?? null,
    adminListPerPage: existing.adminListPerPage ?? defaultValues.adminListPerPage,
    adminFooterText: existing.adminFooterText ?? defaultValues.adminFooterText,
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
