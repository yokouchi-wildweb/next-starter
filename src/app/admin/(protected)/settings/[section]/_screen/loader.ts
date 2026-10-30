// src/app/admin/(protected)/settings/[section]/_screen/loader.ts
// /admin/settings/[section] の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 未知のセクションキーは 404。セクションに allowRoles があれば、そのロール以外は /admin へ redirect する
// (範囲 admin/(protected) の createLoader が管理者カテゴリを評価済み。ここはセクション単位の追加制限で、ctx.allows で判定する)。全体設定(global)を取得する。

import "server-only";
import { notFound, redirect } from "next/navigation";

import type { ScreenProps } from "@/lib/screens/types";
import type { Setting } from "@/features/core/setting/entities";
import { getSettingForActor } from "@/features/core/setting/services/server/settingActor";
import { sections } from "@/features/core/setting/extensions/sections";
import type { SettingSectionDefinition } from "@/features/core/setting/types/definition";
import { createLoader } from "@/app/admin/(protected)/guard";

export type AdminSettingSectionScreenParams = { section: string };

export type AdminSettingSectionScreenData = {
  sectionKey: string;
  section: SettingSectionDefinition;
  setting: Setting;
  /** 保存後の戻り先(このセクション自身) */
  redirectPath: string;
};

export const loadAdminSettingSectionScreen = createLoader({
  access: { roleCategories: ["admin"] },
  key: async (props: ScreenProps<AdminSettingSectionScreenParams>): Promise<[string]> => {
    const { section } = await props.params;
    return [section];
  },
  load: async ({ allows, user }, sectionKey): Promise<AdminSettingSectionScreenData> => {
    const section = sections[sectionKey];
    if (!section) notFound();

    if (section.allowRoles && section.allowRoles.length > 0) {
      if (!allows({ roles: [...section.allowRoles] })) redirect("/admin");
    }

    const setting = (await getSettingForActor(user!)) as Setting; // 範囲の guard が管理者カテゴリを確かめ済み
    return { sectionKey, section, setting, redirectPath: `/admin/settings/${sectionKey}` };
  },
});

