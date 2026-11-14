// src/features/core/messaging/components/MessagePreferences/index.tsx
// セクションコンテナ(本人の通知の設定)。応答の入れ子のまま 経路 > 種別の枠 > グループ > 種類 に並べる(D60・D62・D82・D86):
// - 上に「すべての連絡を止める」(全部)
// - 経路の枠(PreferenceChannelSection)ごとに経路まるごとの切り替え、宛先の無い経路は連携の案内
// - 種別の枠(PreferenceKindFrame)は見出しだけ(種別のスイッチは出さない、D62。表示名は constants の MESSAGE_KIND_LABELS = 仮)
// - グループの見出し(PreferenceGroupHeading、グループの無い種類は見出し無しで先)→ 種類の行(PreferenceCategoryRow = その経路の 1 マス)
// - 種類まるごと(すべての経路)の切り替え(PreferenceCategoryWideToggle)は、その種類が最初に出る経路の行に 1 回だけ置く
// - 全部を止めている間は広い切り替え(経路まるごと・種類まるごと)も止まった状態で見せて押せない(stoppedByAll)
// 読み書きは hook useMessagePreferences だけ。取引の連絡(パスワードの再設定など)はここに出ず、止められない。
// 下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

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
import { PreferenceCategoryWideToggle } from "@/features/core/messaging/components/common/PreferenceCategoryWideToggle";
import { PreferenceChannelSection } from "@/features/core/messaging/components/common/PreferenceChannelSection";
import { PreferenceGroupHeading } from "@/features/core/messaging/components/common/PreferenceGroupHeading";
import { PreferenceKindFrame } from "@/features/core/messaging/components/common/PreferenceKindFrame";
import { MESSAGE_KIND_LABELS } from "@/features/core/messaging/constants/kindLabels";
import { useMessagePreferences } from "@/features/core/messaging/hooks/useMessagePreferences";

export type MessagePreferencesProps = {
  /** 経路が 1 つも無いときの文言 */
  emptyText?: string;
};

const FAILED = "通知の設定を変えられませんでした";

export function MessagePreferences({ emptyText = "設定できる通知はありません" }: MessagePreferencesProps) {
  const { showToast } = useToast();
  const { preferences, isLoading, error, retry, setCell, setCategoryWide, setChannelWide, setAll, pendingKey } =
    useMessagePreferences();

  const guard = useCallback(
    (run: () => Promise<unknown>) => {
      run().catch((e: unknown) => showToast(err(e, FAILED), "error"));
    },
    [showToast],
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

  // 変えている最中と全部の停止の間は、ほかの切り替えを押せなくする(全部の行の下はどれも戻せない)
  const busy = pendingKey !== null;
  const locked = busy || preferences.allOptedOut;
  const categoryWide = new Map(preferences.categories.map((c) => [c.key, c.optedOut]));
  const placedCategoryWide = new Set<string>();
  const shownChannels = preferences.channels.filter((channel) => channel.kinds.length > 0);

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
            onChange={(stopAll) => guard(() => setAll(stopAll))}
            disabled={busy}
            aria-label="すべての連絡を止める"
          />
        </Flex>
      </Block>
      {shownChannels.length === 0 ? (
        <Para tone="muted" align="center">
          {emptyText}
        </Para>
      ) : (
        shownChannels.map((channel) => (
          <PreferenceChannelSection
            key={channel.key}
            channel={channel}
            disabled={locked}
            stoppedByAll={preferences.allOptedOut}
            onChannelWideChange={(stop) => guard(() => setChannelWide(channel.key, stop))}
          >
            {channel.kinds.map((frame) => (
              <PreferenceKindFrame key={frame.kind} label={MESSAGE_KIND_LABELS[frame.kind]}>
                {frame.groups.map((group) => (
                  <Stack key={group.key ?? "-"} space={2}>
                    <PreferenceGroupHeading label={group.label} />
                    {group.categories.map((category) => {
                      const firstPlace = !placedCategoryWide.has(category.key);
                      placedCategoryWide.add(category.key);
                      return (
                        <PreferenceCategoryRow
                          key={category.key}
                          category={category}
                          channelLabel={channel.label}
                          disabled={busy}
                          onChange={(receive) => guard(() => setCell(category.key, channel.key, receive))}
                        >
                          {firstPlace && categoryWide.has(category.key) ? (
                            <PreferenceCategoryWideToggle
                              categoryLabel={category.label}
                              stopped={categoryWide.get(category.key) ?? false}
                              disabled={locked}
                              stoppedByAll={preferences.allOptedOut}
                              onChange={(stop) => guard(() => setCategoryWide(category.key, stop))}
                            />
                          ) : null}
                        </PreferenceCategoryRow>
                      );
                    })}
                  </Stack>
                ))}
              </PreferenceKindFrame>
            ))}
          </PreferenceChannelSection>
        ))
      )}
    </Stack>
  );
}
