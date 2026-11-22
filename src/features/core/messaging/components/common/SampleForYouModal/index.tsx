// src/features/core/messaging/components/common/SampleForYouModal/index.tsx
// 部品(props だけ): 「あなた宛ての表示例」のモーダル(D129)。送る画面の上に重ねて開く。
// 送る口が自分宛てに描いた物(埋め込み情報を差し込み済み)を送信チャンネルのタブで見せる: メール = 送る HTML、お知らせ = 受け取り箱と同じ見せ方(MessagePreview)。
// 取得と開閉は呼び手(hook useMessageSendModal: runPreview で開き、closePreview で閉じる)

"use client";

import { useState } from "react";

import { Stack } from "@/components/Layout/Stack";
import { StateTabs, StateTabsContent } from "@/components/Navigation/StateTabs";
import Modal from "@/components/Overlays/Modal";
import { Para } from "@/components/TextBlocks/Para";

import { messageChannelLabel } from "@/features/core/messaging/constants/channelLabels";

import { MessagePreview, type MessagePreviewChannel } from "../MessagePreview";

export type SampleForYouModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 送る口が描いた送信チャンネルごとの物(POST /send/preview の channels) */
  channels: readonly MessagePreviewChannel[];
  /** メールの iframe の高さ(px、既定 560) */
  emailHeight?: number;
};

export function SampleForYouModal({ open, onOpenChange, channels, emailHeight = 560 }: SampleForYouModalProps) {
  // 選んだタブ(画面の中だけの状態)。タブから消えたら最初のタブ
  const [tabState, setTab] = useState<string | null>(null);
  const tab = tabState && channels.some((channel) => channel.key === tabState) ? tabState : (channels[0]?.key ?? "");
  const current = channels.find((channel) => channel.key === tab) ?? null;
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="あなた宛ての表示例" maxWidth="760px">
      {channels.length === 0 || !current ? (
        <Para size="sm" tone="muted" className="my-0">
          プレビューできる送信方法がありません
        </Para>
      ) : (
        <Stack gap="sm" data-slot="sample-for-you">
          <Para size="sm" tone="muted" className="my-0">
            あなたに届く時の表示です(埋め込み情報はあなたの値で差し込んでいます)
          </Para>
          <StateTabs
            tabs={channels.map((channel) => ({ value: channel.key, label: channel.label ?? messageChannelLabel(channel.key) }))}
            value={tab}
            onValueChange={setTab}
            ariaLabel="表示例の送信方法"
            size="sm"
          >
            <StateTabsContent value={tab} className="pt-3">
              <MessagePreview channels={[current]} emailHeight={emailHeight} showLabels={false} />
            </StateTabsContent>
          </StateTabs>
        </Stack>
      )}
    </Modal>
  );
}
