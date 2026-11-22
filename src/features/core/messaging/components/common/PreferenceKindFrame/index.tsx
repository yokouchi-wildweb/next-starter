// src/features/core/messaging/components/common/PreferenceKindFrame/index.tsx
// 部品(props だけ): 送信チャンネルの中の種別の枠(見出しだけ。種別のスイッチは出さない、D62)。中身(グループとカテゴリーの行)は children

import type { ReactNode } from "react";

import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

export type PreferenceKindFrameProps = {
  /** 種別の表示名(既定の画面は presenters の messageKindLabel = config の kindLabels の label) */
  label: string;
  children?: ReactNode;
};

export function PreferenceKindFrame({ label, children }: PreferenceKindFrameProps) {
  return (
    <Stack gap="xs">
      <Para size="sm" weight="bold" tone="muted">
        {label}
      </Para>
      {children}
    </Stack>
  );
}
