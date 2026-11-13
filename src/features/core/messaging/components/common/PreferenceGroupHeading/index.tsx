// src/features/core/messaging/components/common/PreferenceGroupHeading/index.tsx
// 部品(props だけ): 種別の枠の中のグループの見出し(categoryGroups の受け口)。label null(グループの無い種類)は何も描かない

import { Para } from "@/components/TextBlocks/Para";

export type PreferenceGroupHeadingProps = {
  label: string | null;
};

export function PreferenceGroupHeading({ label }: PreferenceGroupHeadingProps) {
  if (label === null) return null;
  return (
    <Para size="sm" weight="bold">
      {label}
    </Para>
  );
}
