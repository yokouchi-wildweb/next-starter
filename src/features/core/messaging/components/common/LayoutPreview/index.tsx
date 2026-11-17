// src/features/core/messaging/components/common/LayoutPreview/index.tsx
// 部品(props だけ): ひな形の実際の描き方のプレビュー(D114)。経路のタブ(種類の経路)で切り替える。
// - メール = 送る HTML(server のプレビュー API が送る口と同じ 3 段で描いた物。iframe は MessagePreview)
// - お知らせ(inApp)= カード: 受け取り箱と同じ部品 InboxLayoutView(ひな形のお知らせの描き方 > 汎用(fields があれば)> 要約のカード)
// - ほかの経路 = API の文(text)か要約
// - 描けない(3 段のどれでも描けない)時は理由
// 取得はしない: 中身は呼び手の hook が渡す(テンプレート・送る画面 = useLayoutPreview、文言の編集・回の詳細 = それぞれの取得元)

"use client";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { StateTabs, StateTabsContent } from "@/components/Navigation/StateTabs";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { err } from "@/lib/errors";
import type { MessageLayoutFields, MessageLayoutSummary } from "@/lib/messaging";

import { messageChannelLabel } from "@/features/core/messaging/constants/channelLabels";
import { InboxLayoutView, InboxSummaryCard } from "../InboxLayoutView";
import { MessagePreview } from "../MessagePreview";

/** 経路 1 つの描く物(取得元を問わない形): 送る HTML / 文、またはひな形の欄の中身と要約(お知らせのカード)、または描けない理由 */
export type LayoutPreviewContent = {
  /** 送る HTML(メール) */
  html?: string | null;
  text?: string | null;
  /** 件名・題 */
  title?: string | null;
  /** その経路の欄の中身(お知らせのカードに渡す) */
  values?: Readonly<Record<string, unknown>> | null;
  summary?: MessageLayoutSummary | null;
  /** お知らせの欄の宣言(汎用の描き方に使う。無ければ汎用の段を飛ばす) */
  fields?: MessageLayoutFields | null;
  /** 描けない理由(あれば他を描かない) */
  cannotRender?: string | null;
};

export type LayoutPreviewProps = {
  /** ひな形の鍵(無い = 「ひな形を選ぶと出ます」) */
  layout: string | null;
  /** 経路の鍵(タブの順) */
  channels: readonly string[];
  /** 選んだ経路 */
  channel: string | null;
  onChannelChange: (channel: string) => void;
  /** 選んだ経路の描く物(無い = まだ無い) */
  content: LayoutPreviewContent | null;
  loading?: boolean;
  error?: unknown;
  /** メールの iframe の高さ(px) */
  emailHeight?: number;
};

export function LayoutPreview({ layout, channels, channel, onChannelChange, content, loading, error, emailHeight }: LayoutPreviewProps) {
  if (!layout) {
    return (
      <Para size="sm" tone="muted" className="my-0">
        ひな形を選ぶとプレビューが出ます
      </Para>
    );
  }
  if (channels.length === 0 || !channel) {
    return (
      <Para size="sm" tone="muted" className="my-0">
        送信方法がありません(カテゴリーを選んでください)
      </Para>
    );
  }
  return (
    <StateTabs
      tabs={channels.map((key) => ({ value: key, label: messageChannelLabel(key) }))}
      value={channel}
      onValueChange={onChannelChange}
      ariaLabel="プレビューの送信方法"
      size="sm"
    >
      <StateTabsContent value={channel} className="pt-3">
        <Stack space={2} data-slot="layout-preview">
          {loading ? (
            <Flex align="center" gap="xs">
              <Spinner className="size-4" />
              <Span size="xs" tone="muted">
                プレビューを更新しています
              </Span>
            </Flex>
          ) : null}
          {error ? (
            <Para size="sm" tone="destructive" className="my-0">
              {err(error, "プレビューを作れませんでした")}
            </Para>
          ) : null}
          {content?.cannotRender ? (
            <Para size="sm" tone="destructive" className="my-0">
              この送信方法では描けません: {content.cannotRender}
            </Para>
          ) : content ? (
            <ChannelBody layout={layout} channel={channel} content={content} emailHeight={emailHeight} />
          ) : null}
        </Stack>
      </StateTabsContent>
    </StateTabs>
  );
}

type ChannelBodyProps = {
  layout: string;
  channel: string;
  content: LayoutPreviewContent;
  emailHeight?: number;
};

function ChannelBody({ layout, channel, content, emailHeight }: ChannelBodyProps) {
  if (channel === "inApp") {
    // 利用者の受け取り箱の詳しい表示と同じ部品(ひな形のお知らせの描き方 > 汎用 > 要約のカード)
    const summary = content.summary;
    if (!summary) return <NoPreview />;
    return (
      <Block className="rounded-md border border-border bg-card p-4" data-slot="layout-preview-in-app">
        <InboxLayoutView layout={layout} values={content.values ?? null} fields={content.fields ?? null} summary={summary} />
      </Block>
    );
  }
  if (content.html || content.text) {
    return (
      <MessagePreview
        emailHeight={emailHeight}
        channels={[
          {
            key: channel,
            label: messageChannelLabel(channel),
            fields: { subject: content.title ?? "" },
            ...(content.html ? { html: content.html } : {}),
            ...(content.text ? { text: content.text } : {}),
          },
        ]}
      />
    );
  }
  return content.summary ? (
    <Block className="rounded-md border border-border bg-card p-4" data-slot="layout-preview-summary">
      <InboxSummaryCard summary={content.summary} />
    </Block>
  ) : (
    <NoPreview />
  );
}

function NoPreview() {
  return (
    <Para size="sm" tone="muted" className="my-0">
      この送信方法のプレビューはありません
    </Para>
  );
}
