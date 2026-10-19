// src/app/admin/(protected)/settings/[section]/_screen/loader.ts
// /admin/settings/[section] の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 未知のセクションキーは 404。セクションに allowRoles があれば、そのロール以外は /admin へ redirect する
// (管理画面全体の authGuard は layout が済ませている。ここはセクション単位の追加制限)。全体設定(global)を取得する。

import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";

import type { ScreenProps } from "@/lib/screens/types";
import { authGuard } from "@/features/core/auth/services/server/authorization";
import type { Setting } from "@/features/core/setting/entities";
import { settingService } from "@/features/core/setting/services/server/settingService";
import { settingSections, type SettingSection } from "@/features/core/setting/setting.sections";

export type AdminSettingSectionScreenParams = { section: string };

export type AdminSettingSectionScreenData = {
  sectionKey: string;
  section: SettingSection;
  setting: Setting;
  /** 保存後の戻り先(このセクション自身) */
  redirectPath: string;
};

const resolveAdminSettingSectionScreen = cache(async (sectionKey: string): Promise<AdminSettingSectionScreenData> => {
  const section = settingSections[sectionKey];
  if (!section) notFound();

  if (section.allowRoles && section.allowRoles.length > 0) {
    await authGuard({ allowRoles: section.allowRoles, redirectTo: "/admin" });
  }

  const setting = await settingService.getGlobalSetting();
  return { sectionKey, section, setting, redirectPath: `/admin/settings/${sectionKey}` };
});

export async function loadAdminSettingSectionScreen(
  props: ScreenProps<AdminSettingSectionScreenParams>,
): Promise<AdminSettingSectionScreenData> {
  const { section } = await props.params;
  return resolveAdminSettingSectionScreen(section);
}
