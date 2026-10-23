// src/components/Form/Field/Configured/MissingPurposeNotice.tsx
// FieldConfig.purpose（ファイルの用途 ID）の無いメディア項目に出す表示

import { Para } from "@/components/TextBlocks";

/** purpose の無いメディア項目の表示。アップロード先の用途が決まらないので入力を出さない */
export function MissingPurposeNotice({ name }: { name: string }) {
  return (
    <Para tone="destructive" size="sm">
      メディア項目「{name}」に用途 ID（purpose）が未設定のため、アップロードできません。
    </Para>
  );
}
