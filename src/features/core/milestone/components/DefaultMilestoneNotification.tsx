// マイルストーン達成のデフォルト通知コンポーネント
//
// レンダラーレジストリに登録されていないマイルストーンに対して表示される汎用通知。
// 下流プロジェクトが components/renderers/ に同じキーのレンダラーを置くと、
// そちらが優先される。

"use client";

import { Trophy } from "lucide-react";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import type { MilestoneRendererProps } from "@/features/core/milestone/types/milestoneRenderer";

export function DefaultMilestoneNotification({ result }: MilestoneRendererProps) {
  return (
    <Flex align="center" gap="sm">
      <Trophy className="h-4 w-4 text-warning-text" />
      <Para size="sm">{result.milestoneKey}</Para>
    </Flex>
  );
}
