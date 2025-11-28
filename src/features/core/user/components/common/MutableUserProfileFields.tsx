// src/features/user/components/common/MutableUserProfileFields.tsx

"use client";

import type { FC } from "react";

/**
 * プロフィール編集フォームで共通利用する可変フィールド群。
 * 現時点ではダミーフィールドのみをコメントアウトで保持し、
 * 実際のフィールドは今後の実装で追加する予定です。
 */
export const MutableUserProfileFields: FC = () => {
  return (
    <>
      {/*
      <FormFieldItem
        control={control}
        name="dummy"
        label="ダミーフィールド"
        renderInput={(field) => <TextInput field={field} />}
      />
      */}
    </>
  );
};
