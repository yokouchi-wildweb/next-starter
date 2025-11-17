// src/features/setting/services/server/settingService.ts
import type { Setting } from "@/features/setting/entities";
import type { User } from "@/features/user/entities";
import { registerAdminFromConsole } from "@/features/user/services/server/registrations";

import type { AdminSetupInput } from "../types";
import { base } from "./drizzleBase";

const DEFAULT_ADMIN_LIST_PER_PAGE = 50;

const createDefaultSettingValues = () => ({
  adminHeaderLogoImageUrl: null,
  adminHeaderLogoImageDarkUrl: null,
  adminListPerPage: DEFAULT_ADMIN_LIST_PER_PAGE,
  adminFooterText: `© ${new Date().getFullYear()} Wildweb Tokyo.`,
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
    adminFooterText: existing.adminFooterText ?? defaultValues.adminFooterText,
  };
}

async function getAdminListPerPage(): Promise<number> {
  const setting = await getGlobalSetting();
  return setting.adminListPerPage;
}

export async function initializeAdminSetup(data: AdminSetupInput): Promise<User> {
  const user = await registerAdminFromConsole(data);
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
