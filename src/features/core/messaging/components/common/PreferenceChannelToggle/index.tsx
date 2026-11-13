// src/features/core/messaging/components/common/PreferenceChannelToggle/index.tsx
// 部品(props だけ): 1 つの種類 × 1 つの経路の切り替え(SwitchInput、入 = 受け取る)。
// 広い行(全体・種類ごと・経路ごと)で止まっているマスは切 + 押せない + 理由(種別まるごとは押せる、入にすると書き分ける)。宛先の無い経路は「宛先がありません」+ 連携の案内(connectHref)

"use client";

import { SwitchInput } from "@/components/Form/Input/Manual";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Link } from "@/components/Navigation";
import { Span } from "@/components/TextBlocks/Span";

import type {
  MessagePreferenceCellDto,
  MessagePreferenceChannelDto,
} from "@/features/core/messaging/services/client/preferenceClient";

export type PreferenceChannelToggleProps = {
  channel: MessagePreferenceChannelDto;
  cell: MessagePreferenceCellDto;
  /** 変えている最中(押せない) */
  pending?: boolean;
  /** receive = true で受け取る */
  onChange: (receive: boolean) => void;
  /** 連携の案内の文言(既定「連携する」) */
  connectLabel?: string;
};

/** 広い行で止まっている理由(このマスの切り替えでは戻せない)。null = このマスで切り替えられる */
export function preferenceLockReason(cell: MessagePreferenceCellDto): string | null {
  if (cell.via === "all") return "すべての連絡を止めています";
  if (cell.via === "category" || cell.via === "channel") return "まとめて止める設定で止まっています";
  // 種別まるごと: このマスを入にすると上流の処理が書き分ける(D71)ので押せる
  if (cell.via === "kind") return null;
  return null;
}

export function PreferenceChannelToggle({ channel, cell, pending = false, onChange, connectLabel = "連携する" }: PreferenceChannelToggleProps) {
  const lockReason = preferenceLockReason(cell);
  return (
    <Flex justify="between" align="center" gap="md">
      <Stack space={0}>
        <Span size="sm">{channel.label}</Span>
        {lockReason ? (
          <Span size="xs" tone="muted">
            {lockReason}
          </Span>
        ) : null}
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
        value={!cell.optedOut}
        onChange={(receive) => onChange(receive)}
        disabled={pending || lockReason !== null}
        aria-label={`${channel.label}で受け取る`}
      />
    </Flex>
  );
}
