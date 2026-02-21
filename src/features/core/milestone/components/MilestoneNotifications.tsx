// マイルストーン達成通知リスト
//
// PurchaseComplete 等から利用される。
// 達成されたマイルストーンごとに、登録済みレンダラーまたはデフォルト通知を表示する。

"use client";

import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Trophy } from "lucide-react";
import type { PersistedMilestoneResult } from "@/features/core/milestone/types/milestone";
import { getMilestoneRenderer } from "./milestoneRendererRegistry";
import { DefaultMilestoneNotification } from "./DefaultMilestoneNotification";

// レンダラー定義の副作用インポート（登録を実行）
import "./renderers";

type MilestoneNotificationsProps = {
  results: PersistedMilestoneResult[];
};

export function MilestoneNotifications({ results }: MilestoneNotificationsProps) {
  const achieved = results.filter((r) => r.achieved);
  if (achieved.length === 0) return null;

  return (
    <Stack appearance="surface" padding="md" space={4} className="rounded-lg">
      <Flex align="center" gap="sm">
        <Trophy className="h-5 w-5 text-yellow-500" />
        <Para size="sm" weight="bold">達成したマイルストーン</Para>
      </Flex>
      <Stack space={2}>
        {achieved.map((result) => {
          const renderer = getMilestoneRenderer(result.milestoneKey);
          const Component = renderer?.component ?? DefaultMilestoneNotification;
          return <Component key={result.milestoneKey} result={result} />;
        })}
      </Stack>
    </Stack>
  );
}
