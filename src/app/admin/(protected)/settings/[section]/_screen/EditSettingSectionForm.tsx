// src/app/admin/(protected)/settings/[section]/_screen/EditSettingSectionForm.tsx
// セクション駆動の設定編集フォーム。form・送信・toast・遷移は公開 hook useSettingSectionForm(欄はキーの定義から作り、
// そのセクションのキーだけを送る)。ここは AppForm + FieldRenderer + ボタンを描くだけ。
// コードで持つキー(codeKeys)の欄は hook が読み取り専用にする。送るキーが無い節(editable が false)は保存のボタンを出さない。

"use client";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { FieldRenderer } from "@/components/Form/FieldRenderer";
import { Flex } from "@/components/Layout/Flex";
import type { Setting } from "@/features/core/setting/entities";
import { useSettingSectionForm } from "@/features/core/setting/hooks/useSettingSectionForm";

type Props = {
  /** セクションの key(定義のアイコンは Server Component から渡せないのでここで引く) */
  sectionKey: string;
  /** 現在の設定値(そのロールに許されたキーだけ) */
  setting: Setting;
  /** 更新後のリダイレクト先 */
  redirectPath?: string;
  /** コードで持つキー(loader の値) */
  codeKeys?: readonly string[];
};

export default function EditSettingSectionForm({ sectionKey, setting, redirectPath = "/", codeKeys }: Props) {
  const { methods, section, fieldConfigs, submit, isMutating, editable } = useSettingSectionForm({ sectionKey, setting, redirectPath, codeKeys });

  return (
    <AppForm methods={methods} onSubmit={submit} pending={isMutating} fieldSpace="lg">
      <FieldRenderer
        control={methods.control}
        methods={methods}
        baseFields={fieldConfigs}
        fieldGroups={section.groups}
      />
      {editable ? (
        <Flex justify="center">
          <Button type="submit" disabled={isMutating} variant="default">
            更新
          </Button>
        </Flex>
      ) : null}
    </AppForm>
  );
}
