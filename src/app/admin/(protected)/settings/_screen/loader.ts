// src/app/admin/(protected)/settings/_screen/loader.ts
// /admin/settings の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 遷移制御だけの loader(Promise<void>)。既定のセクション(/admin/settings/<既定キー>)へ常に redirect する。

import "server-only";
import { redirect } from "next/navigation";

import { sections } from "@/features/core/setting/extensions/sections";
import { listSections } from "@/features/core/setting/utils/sectionForm";
import { createLoader } from "@/app/admin/(protected)/guard";

export const loadAdminSettingIndexScreen = createLoader({
  access: { roleCategories: ["admin"] },
  load: async (): Promise<void> => {
    const [first] = listSections(sections);
    if (!first) throw new Error("[setting] セクションがありません");
    redirect(`/admin/settings/${first.key}`);
  },
});
