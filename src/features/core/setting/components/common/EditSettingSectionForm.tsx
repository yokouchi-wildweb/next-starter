// src/features/core/setting/components/common/EditSettingSectionForm.tsx

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { FieldRenderer } from "@/components/Form/FieldRenderer";

import { SettingCombinedUpdateSchema } from "@/features/core/setting/entities";
import type { Setting } from "@/features/core/setting/entities";
import type { SettingUpdateFields } from "@/features/core/setting/entities/form";
import type { SettingExtendedUpdateFields } from "@/features/core/setting/entities/form.extended";
import { useUpdateSetting } from "@/features/core/setting/hooks/useUpdateSetting";
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { getZodDefaults } from "@/lib/zod";

import { settingExtendedSchema } from "../../setting.extended";
import type { SettingSection } from "../../setting.sections";

// 送信時の型（base + extended 統合）
// セクションに属さないフィールドも jsonb 保持のために同梱するため全部入り
type CombinedSettingUpdateFields = SettingUpdateFields & SettingExtendedUpdateFields;

type Props = {
  /** セクション定義（表示するフィールドやグループ構成を決定する） */
  section: SettingSection;
  /** 現在の設定値（全フィールドをフラット展開した状態） */
  setting: Setting;
  /** 更新後のリダイレクト先 */
  redirectPath?: string;
};

/**
 * セクション駆動の汎用設定編集フォーム
 *
 * - `section.fields` だけを UI にレンダリング（他セクションのフィールドは非表示）
 * - ただし `defaultValues` には全フィールドを読み込み、送信時に維持する
 *   （`extended` jsonb カラムは部分更新ができず全置換となるため）
 */
export default function EditSettingSectionForm({
  section,
  setting,
  redirectPath = "/",
}: Props) {
  const extendedDefaults = getZodDefaults(settingExtendedSchema);

  const methods = useForm<CombinedSettingUpdateFields>({
    resolver: zodResolver(SettingCombinedUpdateSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      // 基本カラム（adminListPerPage 等）
      adminListPerPage: setting.adminListPerPage ?? 100,
      // 拡張項目（未表示フィールドも保持するため全件ロード）
      ...extendedDefaults,
      ...Object.fromEntries(
        Object.keys(settingExtendedSchema.shape).map((key) => [
          key,
          (setting as unknown as Record<string, unknown>)[key]
            ?? extendedDefaults[key as keyof typeof extendedDefaults],
        ]),
      ),
    } as CombinedSettingUpdateFields,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useUpdateSetting();

  const submit = async (data: CombinedSettingUpdateFields) => {
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
    <AppForm
      methods={methods}
      onSubmit={submit}
      pending={isMutating}
      fieldSpace={6}
    >
      <FieldRenderer
        control={methods.control}
        methods={methods}
        baseFields={section.fields}
        fieldGroups={section.fieldGroups}
        inlineGroups={section.inlineGroups}
      />
      <div className="flex justify-center">
        <Button type="submit" disabled={isMutating} variant="default">
          更新
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => methods.reset()}
          className="ml-4"
        >
          キャンセル
        </Button>
      </div>
    </AppForm>
  );
}
