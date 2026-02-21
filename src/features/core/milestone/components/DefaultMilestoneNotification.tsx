// マイルストーン達成のデフォルト通知コンポーネント
//
// レンダラーレジストリに登録されていないマイルストーンに対して表示される汎用通知。
// 下流プロジェクトが registerMilestoneRenderer で同じキーのレンダラーを登録すると、
// そちらが優先される。

"use client";

import { Trophy } from "lucide-react";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import type { MilestoneRendererProps } from "./milestoneRendererRegistry";

export function DefaultMilestoneNotification({ result }: MilestoneRendererProps) {
  return (
    <Flex align="center" gap="sm">
      <Trophy className="h-4 w-4 text-yellow-500" />
      <Para size="sm">{result.milestoneKey}</Para>
    </Flex>
  );
}
