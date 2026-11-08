// src/app/admin/(protected)/settings/[section]/_screen/EditSettingSectionForm.tsx
// セクション駆動の設定編集フォーム。form・送信・toast・遷移は公開 hook useSettingSectionForm(欄はキーの定義から作り、
// そのセクションのキーだけを送る)。ここは AppForm + FieldRenderer + ボタンを描くだけ。

"use client";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { FieldRenderer } from "@/components/Form/FieldRenderer";
import type { Setting } from "@/features/core/setting/entities";
import { useSettingSectionForm } from "@/features/core/setting/hooks/useSettingSectionForm";

type Props = {
  /** セクションの key(定義のアイコンは Server Component から渡せないのでここで引く) */
  sectionKey: string;
  /** 現在の設定値(そのロールに許されたキーだけ) */
  setting: Setting;
  /** 更新後のリダイレクト先 */
  redirectPath?: string;
};

export default function EditSettingSectionForm({ sectionKey, setting, redirectPath = "/" }: Props) {
  const { methods, section, fieldConfigs, submit, isMutating } = useSettingSectionForm({ sectionKey, setting, redirectPath });

  return (
    <AppForm methods={methods} onSubmit={submit} pending={isMutating} fieldSpace={6}>
      <FieldRenderer
        control={methods.control}
        methods={methods}
        baseFields={fieldConfigs}
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
