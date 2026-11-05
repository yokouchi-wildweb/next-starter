// src/app/admin/(protected)/settings/_screen/loader.ts
// /admin/settings の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 遷移制御だけの loader(Promise<void>)。既定のセクション(/admin/settings/<既定キー>)へ常に redirect する。
// 既定 = order 昇順で住所が閉じていない最初のセクション(閉じた機能の節は門番が住所で閉じる: 節の feature、src/featureGate/README.md)。

import "server-only";
import { redirect } from "next/navigation";

import { gate } from "@/featureGate";
import { sections } from "@/features/core/setting/extensions/sections";
import { firstOpenSection, settingSectionHref } from "@/features/core/setting/utils/sectionForm";
import { createLoader } from "@/app/admin/(protected)/guard";

export const loadAdminSettingIndexScreen = createLoader({
  access: { roleCategories: ["admin"] },
  load: async (): Promise<void> => {
    const first = firstOpenSection(sections, (href) => gate.path(href).open);
    if (!first) throw new Error("[setting] 開いているセクションがありません");
    redirect(settingSectionHref(first.key));
  },
});
