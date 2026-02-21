// マイルストーン達成通知
//
// PurchaseComplete 等から利用される。
// 達成されたマイルストーンごとに、登録済みレンダラーまたはデフォルト通知を表示する。
//
// displayMode による分離:
// - inline: リスト内にインライン表示（従来動作）
// - modal: リストから除外し、別途モーダルとして描画

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

  // displayMode でインラインとモーダルを分離
  const inlineResults: { result: PersistedMilestoneResult; Component: React.ComponentType<{ result: PersistedMilestoneResult }> }[] = [];
  const modalResults: { result: PersistedMilestoneResult; Component: React.ComponentType<{ result: PersistedMilestoneResult }> }[] = [];

  for (const result of achieved) {
    const renderer = getMilestoneRenderer(result.milestoneKey);
    const displayMode = renderer?.displayMode ?? "inline";
    const Component = renderer?.component ?? DefaultMilestoneNotification;

    if (displayMode === "modal") {
      modalResults.push({ result, Component });
    } else {
      inlineResults.push({ result, Component });
    }
  }

  return (
    <>
      {/* インライン通知リスト */}
      {inlineResults.length > 0 && (
        <Stack appearance="surface" padding="md" space={4} className="rounded-lg">
          <Flex align="center" gap="sm">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <Para size="sm" weight="bold">達成したマイルストーン</Para>
          </Flex>
          <Stack space={2}>
            {inlineResults.map(({ result, Component }) => (
              <Component key={result.milestoneKey} result={result} />
            ))}
          </Stack>
        </Stack>
      )}

      {/* モーダル通知（各レンダラーが自身のモーダルUIを管理する） */}
      {modalResults.map(({ result, Component }) => (
        <Component key={result.milestoneKey} result={result} />
      ))}
    </>
  );
}
