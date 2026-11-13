// src/features/core/messaging/components/common/PreferenceChannelSection/index.tsx
// 部品(props だけ): 1 つの経路の枠(第 1 階層)。題・経路まるごとの切り替え(入 = この経路で受け取る)・宛先の無い時の連携の案内。
// 中身(種別の枠)は children

"use client";

import type { ReactNode } from "react";

import { SwitchInput } from "@/components/Form/Input/Manual";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Link } from "@/components/Navigation";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Span } from "@/components/TextBlocks/Span";

import type { MessagePreferenceChannelDto } from "@/features/core/messaging/services/client/preferenceClient";

export type PreferenceChannelSectionProps = {
  channel: Pick<MessagePreferenceChannelDto, "key" | "label" | "hasAddress" | "connectHref" | "optedOut">;
  /** 経路まるごとの切り替えを押せなくする(変えている最中・全部を止めている間) */
  disabled?: boolean;
  /** stop = true で経路まるごとを止める */
  onChannelWideChange: (stop: boolean) => void;
  /** 連携の案内の文言(既定「連携する」) */
  connectLabel?: string;
  children?: ReactNode;
};

export function PreferenceChannelSection({
  channel,
  disabled = false,
  onChannelWideChange,
  connectLabel = "連携する",
  children,
}: PreferenceChannelSectionProps) {
  return (
    <Block className="rounded-md border border-border p-4">
      <Stack space={4}>
        <Flex justify="between" align="center" gap="md">
          <Stack space={0}>
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
          </Stack>
          <SwitchInput
            value={!channel.optedOut}
            onChange={(receive) => onChannelWideChange(!receive)}
            disabled={disabled}
            aria-label={`${channel.label}で受け取る`}
          />
        </Flex>
        {children}
      </Stack>
    </Block>
  );
}
