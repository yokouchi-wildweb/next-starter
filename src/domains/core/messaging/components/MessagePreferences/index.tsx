// src/domains/core/messaging/components/MessagePreferences/index.tsx
// セクションコンテナ(本人の通知の設定)。応答の入れ子のまま 送信チャンネル > 種別の枠 > グループ > カテゴリー に並べる(D60・D62・D82・D86):
// - 上に「すべての連絡を止める」(全部)
// - 送信チャンネルの枠(PreferenceChannelSection)ごとに送信チャンネルまるごとの切り替え、宛先の無い送信チャンネルは連携の案内
// - 種別の枠(PreferenceKindFrame)は見出しだけ(種別のスイッチは出さない、D62。表示名は config の kindLabels の label、presenters の messageKindLabel)
// - グループの見出し(PreferenceGroupHeading、グループの無いカテゴリーは見出し無しで先)→ カテゴリーの行(PreferenceCategoryRow = その送信チャンネルの 1 マス)
// - カテゴリーまるごと(すべての送信チャンネル)の切り替え(PreferenceCategoryWideToggle)は、そのカテゴリーが最初に出る送信チャンネルの行に 1 回だけ置く
// - 全部を止めている間は広い切り替え(送信チャンネルまるごと・カテゴリーまるごと)も止まった状態で見せて押せない(stoppedByAll)
// 読み書きは hook useMessagePreferences だけ。取引の連絡(パスワードの再設定など)はここに出ず、止められない。
// 下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { useCallback } from "react";

import { Button } from "@/components/Button/Button";
import { SwitchInput } from "@/components/Input/SwitchInput";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { InlineLoader } from "@/components/Overlays/Loading";
import { Para } from "@/components/TextBlocks/Para";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import { PreferenceCategoryRow } from "@/domains/core/messaging/components/common/PreferenceCategoryRow";
import { PreferenceCategoryWideToggle } from "@/domains/core/messaging/components/common/PreferenceCategoryWideToggle";
import { PreferenceChannelSection } from "@/domains/core/messaging/components/common/PreferenceChannelSection";
import { PreferenceGroupHeading } from "@/domains/core/messaging/components/common/PreferenceGroupHeading";
import { PreferenceKindFrame } from "@/domains/core/messaging/components/common/PreferenceKindFrame";
import { messageKindLabel } from "@/domains/core/messaging/presenters";
import { useMessagePreferences } from "@/domains/core/messaging/hooks/useMessagePreferences";

export type MessagePreferencesProps = {
  /** 送信チャンネルが 1 つも無いときの文言 */
  emptyText?: string;
};

const FAILED = "通知設定を変更できませんでした";

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
        <Stack gap="xs">
          <Para tone="destructive" align="center">
            {err(error, "通知設定を取得できませんでした")}
          </Para>
          <Flex justify="center">
            <Button type="button" variant="outline" size="sm" onClick={() => void retry()}>
              再試行
            </Button>
          </Flex>
        </Stack>
      );
    }
    return isLoading ? <InlineLoader /> : null;
  }

  // 変えている最中と全部の停止の間は、ほかの切り替えを押せなくする(全部の行の下はどれも戻せない)
  const busy = pendingKey !== null;
  const locked = busy || preferences.allOptedOut;
  const categoryWide = new Map(preferences.categories.map((c) => [c.key, c.optedOut]));
  const placedCategoryWide = new Set<string>();
  const shownChannels = preferences.channels.filter((channel) => channel.kinds.length > 0);

  return (
    <Stack gap="md">
      <Block className="rounded-md border border-border p-4">
        <Flex justify="between" align="center" gap="lg">
          <Stack gap="none">
            <Para weight="bold">すべての通知を受け取らない</Para>
            <Para size="sm" tone="muted">
              サービス内通知・メールをまとめて停止します(お手続きなど重要なお知らせは届きます)
            </Para>
          </Stack>
          <SwitchInput
            value={preferences.allOptedOut}
            onChange={(stopAll) => guard(() => setAll(stopAll))}
            disabled={busy}
            aria-label="すべての通知を受け取らない"
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
              <PreferenceKindFrame key={frame.kind} label={messageKindLabel(frame.kind)}>
                {frame.groups.map((group) => (
                  <Stack key={group.key ?? "-"} gap="xs">
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
