// マイルストーン達成通知
//
// PurchaseComplete 等から利用される。
// 達成されたマイルストーンごとに、登録済みレンダラーまたはデフォルト通知を表示する。
//
// レンダラーの引き方: 段階の鍵(= milestoneKey)→ シリーズの鍵(seriesKey)の順。段階の鍵の項目が勝つ。
// シリーズの鍵で引いた結果は同じシリーズの段を 1 つにまとめ、result = 一番上の段・seriesResults = 段の全部を渡す。
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
import type { MilestoneRendererDefinition, MilestoneRendererProps } from "@/features/core/milestone/types/milestoneRenderer";
import { renderers } from "@/features/core/milestone/extensions/renderers";
import { DefaultMilestoneNotification } from "./DefaultMilestoneNotification";

type MilestoneNotificationsProps = {
  results: PersistedMilestoneResult[];
};

export function MilestoneNotifications({ results }: MilestoneNotificationsProps) {
  const achieved = results.filter((r) => r.achieved);
  if (achieved.length === 0) return null;

  // displayMode でインラインとモーダルを分離
  type RendererEntry = {
    key: string;
    props: MilestoneRendererProps;
    Component: React.ComponentType<MilestoneRendererProps>;
    priority: number;
  };
  const inlineResults: RendererEntry[] = [];
  const modalResults: RendererEntry[] = [];
  const push = (renderer: MilestoneRendererDefinition | undefined, key: string, props: MilestoneRendererProps) => {
    const entry = {
      key,
      props,
      Component: renderer?.component ?? DefaultMilestoneNotification,
      priority: renderer?.priority ?? 0,
    };
    if ((renderer?.displayMode ?? "inline") === "modal") modalResults.push(entry);
    else inlineResults.push(entry);
  };

  // シリーズの鍵で引く結果は、最初に出た位置でシリーズごとにまとめる
  const seriesGroups = new Map<string, PersistedMilestoneResult[]>();
  for (const result of achieved) {
    const own = renderers[result.milestoneKey];
    if (own) {
      push(own, result.milestoneKey, { result });
      continue;
    }
    const seriesRenderer = result.seriesKey ? renderers[result.seriesKey] : undefined;
    if (!seriesRenderer || !result.seriesKey) {
      push(undefined, result.milestoneKey, { result });
      continue;
    }
    const group = seriesGroups.get(result.seriesKey);
    if (group) {
      group.push(result);
      continue;
    }
    const seriesResults = [result];
    seriesGroups.set(result.seriesKey, seriesResults);
    // 同じ配列に後の段が足される。描く時に一番上の段(最後)を result にする
    push(seriesRenderer, `series:${result.seriesKey}`, { result, seriesResults });
  }

  // priority 昇順でソート
  const sortByPriority = (a: { priority: number }, b: { priority: number }) => a.priority - b.priority;
  inlineResults.sort(sortByPriority);
  modalResults.sort(sortByPriority);

  return (
    <>
      {/* インライン通知リスト */}
      {inlineResults.length > 0 && (
        <Stack appearance="surface" padding="md" space={4} className="rounded-lg">
          <Flex align="center" gap="sm">
            <Trophy className="h-5 w-5 text-warning-text" />
            <Para size="sm" weight="bold">達成したマイルストーン</Para>
          </Flex>
          <Stack space={2}>
            {inlineResults.map(({ key, props, Component }) => (
              <Component key={key} result={props.seriesResults?.at(-1) ?? props.result} seriesResults={props.seriesResults} />
            ))}
          </Stack>
        </Stack>
      )}

      {/* モーダル通知（各レンダラーが自身のモーダルUIを管理する） */}
      {modalResults.map(({ key, props, Component }) => (
        <Component key={key} result={props.seriesResults?.at(-1) ?? props.result} seriesResults={props.seriesResults} />
      ))}
    </>
  );
}
