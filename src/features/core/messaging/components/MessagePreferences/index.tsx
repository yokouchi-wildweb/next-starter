// src/features/core/messaging/components/MessagePreferences/index.tsx
// セクションコンテナ(本人の通知の設定): 種類 × 経路の切り替えと「すべての連絡を止める」(種類が先の並び。hook の categoryRows を読む)。
// hook useMessagePreferences で読み書きし、部品(PreferenceCategoryRow / PreferenceChannelToggle)で描く。
// 取引の連絡(パスワードの再設定など)はここに出ず、止められない。下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { useCallback } from "react";

import { Button } from "@/components/Form/Button/Button";
import { SwitchInput } from "@/components/Form/Input/Manual";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { Para } from "@/components/TextBlocks/Para";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import { PreferenceCategoryRow } from "@/features/core/messaging/components/common/PreferenceCategoryRow";
import {
  MESSAGE_PREFERENCE_ALL,
  preferenceCellKey,
  useMessagePreferences,
} from "@/features/core/messaging/hooks/useMessagePreferences";

export type MessagePreferencesProps = {
  /** 種類が 1 つも無いときの文言 */
  emptyText?: string;
};

export function MessagePreferences({ emptyText = "設定できる通知はありません" }: MessagePreferencesProps) {
  const { showToast } = useToast();
  const { preferences, categoryRows, isLoading, error, retry, setCell, setAll, pendingKey } = useMessagePreferences();
  const allKey = preferenceCellKey(MESSAGE_PREFERENCE_ALL, MESSAGE_PREFERENCE_ALL);

  const handleCell = useCallback(
    (category: string, channel: string, receive: boolean) => {
      setCell(category, channel, receive).catch((e: unknown) => showToast(err(e, "通知の設定を変えられませんでした"), "error"));
    },
    [setCell, showToast],
  );

  const handleAll = useCallback(
    (stopAll: boolean) => {
      setAll(stopAll).catch((e: unknown) => showToast(err(e, "通知の設定を変えられませんでした"), "error"));
    },
    [setAll, showToast],
  );

  if (!preferences) {
    if (error) {
      return (
        <Stack space={2}>
          <Para tone="destructive" align="center">
            {err(error, "通知の設定の取得に失敗しました")}
          </Para>
          <Flex justify="center">
            <Button type="button" variant="outline" size="sm" onClick={() => void retry()}>
              再試行
            </Button>
          </Flex>
        </Stack>
      );
    }
    return <Flex justify="center">{isLoading ? <Spinner className="size-6" /> : null}</Flex>;
  }

  return (
    <Stack space={4}>
      <Block className="rounded-md border border-border p-4">
        <Flex justify="between" align="center" gap="md">
          <Stack space={0}>
            <Para weight="bold">すべての連絡を止める</Para>
            <Para size="sm" tone="muted">
              お知らせ・メールをまとめて止めます(取引の連絡は届きます)
            </Para>
          </Stack>
          <SwitchInput
            value={preferences.allOptedOut}
            onChange={(stopAll) => handleAll(stopAll)}
            disabled={pendingKey !== null}
            aria-label="すべての連絡を止める"
          />
        </Flex>
      </Block>
      {categoryRows.length === 0 ? (
        <Para tone="muted" align="center">
          {emptyText}
        </Para>
      ) : (
        categoryRows.map((category) => (
          <PreferenceCategoryRow
            key={category.key}
            category={category}
            channels={preferences.channels}
            disabled={pendingKey === allKey}
            pendingChannel={pendingKey?.startsWith(`${category.key}:`) ? pendingKey.slice(category.key.length + 1) : null}
            onChange={(channel, receive) => handleCell(category.key, channel, receive)}
          />
        ))
      )}
    </Stack>
  );
}
