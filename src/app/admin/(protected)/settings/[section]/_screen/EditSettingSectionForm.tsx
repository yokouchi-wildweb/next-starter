// src/app/admin/(protected)/settings/[section]/_screen/EditSettingSectionForm.tsx
// セクション駆動の設定編集フォーム。欄はキーの定義(setting/fields の ui)から作り、そのセクションのキーだけを送る。

"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { FieldRenderer } from "@/components/Form/FieldRenderer";
import type { Setting } from "@/features/core/setting/entities";
import { fields } from "@/features/core/setting/extensions/fields";
import { sections } from "@/features/core/setting/extensions/sections";
import { useUpdateSetting } from "@/features/core/setting/hooks/useUpdateSetting";
import { buildSectionForm } from "@/features/core/setting/utils/sectionForm";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

type Props = {
  /** セクションの key(定義のアイコンは Server Component から渡せないのでここで引く) */
  sectionKey: string;
  /** 現在の設定値(そのロールに許されたキーだけ) */
  setting: Setting;
  /** 更新後のリダイレクト先 */
  redirectPath?: string;
};

export default function EditSettingSectionForm({ sectionKey, setting, redirectPath = "/" }: Props) {
  const section = sections[sectionKey];
  const form = useMemo(() => buildSectionForm(sectionKey, fields, setting as unknown as Record<string, unknown>), [sectionKey, setting]);

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
      showToast(`${section.label}を更新しました`, "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "更新に失敗しました"), "error");
    }
  };

  return (
    <AppForm methods={methods} onSubmit={submit} pending={isMutating} fieldSpace={6}>
      <FieldRenderer
        control={methods.control}
        methods={methods}
        baseFields={form.fieldConfigs}
        fieldGroups={section.groups}
      />
      <div className="flex justify-center">
        <Button type="submit" disabled={isMutating} variant="default">
          更新
        </Button>
      </div>
    </AppForm>
  );
}
