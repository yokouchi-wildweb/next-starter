// src/features/core/setting/hooks/useSettingSectionForm.ts
//
// 管理画面の設定の 1 節の編集フォーム(/admin/settings/[section])。欄はキーの定義(setting/fields の ui)から作り、
// その節のキーだけを送る。部品は返る methods を AppForm に、fieldConfigs と section.groups を FieldRenderer に渡して描くだけ。
// - submit(values): 更新中の toast → 保存 → 成功の toast → redirectPath へ遷移(未保存の守りの付いた router)
// - 失敗: error の toast を出して投げ直す。AppForm は投げられたときだけ未保存の守りを戻すので、
//   失敗を成功扱いにしない(投げずに返すと守りが外れたままになる)
// setting は今の設定値(そのロールに許されたキーだけ。loader の getSettingForActor の値)。

"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { Setting } from "@/features/core/setting/entities";
import { fields } from "@/features/core/setting/extensions/fields";
import { sections } from "@/features/core/setting/extensions/sections";
import { buildSectionForm } from "@/features/core/setting/utils/sectionForm";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";
import { useRouter } from "@/lib/unsavedGuard";

import { useUpdateSetting } from "./useUpdateSetting";

export type UseSettingSectionFormOptions = {
  /** 節の key(setting/sections の定義) */
  sectionKey: string;
  /** 今の設定値(そのロールに許されたキーだけ) */
  setting: Setting;
  /** 保存の後の遷移先。省略 = "/" */
  redirectPath?: string;
};

const DEFAULT_REDIRECT_PATH = "/";

export function useSettingSectionForm({ sectionKey, setting, redirectPath = DEFAULT_REDIRECT_PATH }: UseSettingSectionFormOptions) {
  const section = sections[sectionKey];
  const form = useMemo(
    () => buildSectionForm(sectionKey, fields, setting as unknown as Record<string, unknown>),
    [sectionKey, setting],
  );

  const methods = useForm({
    resolver: zodResolver(form.schema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: form.defaultValues,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useUpdateSetting();

  const submit = async (data: Record<string, unknown>) => {
    showToast({ message: "更新中です…", mode: "persistent" });
    try {
      await trigger({ id: setting.id, data });
    } catch (error) {
      showToast(err(error, "更新に失敗しました"), "error");
      throw error;
    }
    showToast(`${section.label}を更新しました`, "success");
    router.push(redirectPath);
  };

  return { methods, section, fieldConfigs: form.fieldConfigs, submit, isMutating };
}
