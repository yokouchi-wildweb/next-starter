// src/domains/core/messaging/components/common/PreferenceChannelSection/index.tsx
// 部品(props だけ): 1 つの送信チャンネルの枠(第 1 階層)。題・送信チャンネルまるごとの切り替え(入 = この送信チャンネルで受け取る)・宛先の無い時の連携の案内。
// 全部の停止の間(stoppedByAll)は送信チャンネルの行の値によらず切・押せない・理由を出す(状態は全部に従う。全部を戻すと送信チャンネルの行の値に戻る)
// 中身(種別の枠)は children

"use client";

import type { ReactNode } from "react";

import { SwitchInput } from "@/components/Input/SwitchInput";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Link } from "@/components/Navigation/Link";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Span } from "@/components/TextBlocks/Span";

import { preferenceViaReason } from "@/domains/core/messaging/components/common/PreferenceCategoryRow";
import type { MessagePreferenceChannelDto } from "@/domains/core/messaging/services/client/preferenceClient";

export type PreferenceChannelSectionProps = {
  channel: Pick<MessagePreferenceChannelDto, "key" | "label" | "hasAddress" | "connectHref" | "optedOut">;
  /** 送信チャンネルまるごとの切り替えを押せなくする(変えている最中・全部を止めている間) */
  disabled?: boolean;
  /** すべての連絡を止めている(応答の allOptedOut)。切で見せて押せなくする */
  stoppedByAll?: boolean;
  /** stop = true で送信チャンネルまるごとを止める */
  onChannelWideChange: (stop: boolean) => void;
  /** 連携の案内の文言(既定「連携する」) */
  connectLabel?: string;
  children?: ReactNode;
};

export function PreferenceChannelSection({
  channel,
  disabled = false,
  stoppedByAll = false,
  onChannelWideChange,
  connectLabel = "連携する",
  children,
}: PreferenceChannelSectionProps) {
  return (
    <Block className="rounded-md border border-border p-4">
      <Stack gap="md">
        <Flex justify="between" align="center" gap="lg">
          <Stack gap="none">
            <SecTitle>{channel.label}</SecTitle>
            {!channel.hasAddress ? (
              <Span size="xs" tone="muted">
                宛先が登録されていません
                {channel.connectHref ? (
                  <>
                    {" "}
                    <Link href={channel.connectHref} className="underline">
                      {connectLabel}
                    </Link>
                  </>
                ) : null}
              </Span>
            ) : null}
            {stoppedByAll ? (
              <Span size="xs" tone="muted">
                {preferenceViaReason("all")}
              </Span>
            ) : null}
          </Stack>
          <SwitchInput
            value={!stoppedByAll && !channel.optedOut}
            onChange={(receive) => onChannelWideChange(!receive)}
            disabled={disabled || stoppedByAll}
            aria-label={`${channel.label}で受け取る`}
          />
        </Flex>
        {children}
      </Stack>
    </Block>
  );
}
