// src/features/core/messaging/components/common/LayoutPreview/index.tsx
// 部品(props だけ): ひな形の実際の描き方のプレビュー(D114)。経路のタブ(種類の経路)で切り替える。
// - メール = 送る HTML(server のプレビュー API が送る口と同じ 3 段で描いた物。iframe は MessagePreview)
// - お知らせ(inApp)= カード: 受け取り箱の詳細と同じ部品 InboxLayoutView(ひな形のお知らせの描き方 > 汎用(fields があれば)、要約は描かない D120)
// - ほかの経路 = API の文(text)か要約の文(LINE など文を送る経路は要約がそのまま送る文)
// - 描けない(3 段のどれでも描けない)時は理由
// - 空の欄の目印(テンプレートのプレビュー、D127): 描いた物の目印を仮の枠に置き換える(previewMarkers.ts)。メール = iframe に入れる前の HTML、
//   お知らせのカード = React が隠れた所に描いた物の写しを置き換えて見せる(React の持つ要素は書き換えない)。目印が無ければそのまま
// 取得はしない: 中身は呼び手の hook が渡す(テンプレート・送る画面 = useLayoutPreview、文言の編集・回の詳細 = それぞれの取得元)

"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

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
import { InboxLayoutView } from "../InboxLayoutView";
import { MessagePreview } from "../MessagePreview";

import { hasPreviewMarker, markerText, replacePreviewMarkers } from "./previewMarkers";

export { PREVIEW_MARKER_CLOSE, PREVIEW_MARKER_OPEN, hasPreviewMarker, markerText, previewMarker, replacePreviewMarkers } from "./previewMarkers";

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
  /** 必須の欄が空の経路(タブに「未入力あり」の印、D117) */
  incompleteChannels?: readonly string[];
  /** メールの iframe の高さ(px) */
  emailHeight?: number;
};

export function LayoutPreview({ layout, channels, channel, onChannelChange, content, loading, error, emailHeight, incompleteChannels = [] }: LayoutPreviewProps) {
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
      tabs={channels.map((key) => ({
        value: key,
        label: incompleteChannels.includes(key) ? `${messageChannelLabel(key)}・未入力あり` : messageChannelLabel(key),
      }))}
      value={channel}
      onValueChange={onChannelChange}
      ariaLabel="プレビューの送信方法"
      size="sm"
    >
      <StateTabsContent value={channel} className="pt-3">
        <Stack gap="xs" data-slot="layout-preview">
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
    // 利用者の受け取り箱の詳細と同じ部品(ひな形のお知らせの描き方 > 汎用)
    const summary = content.summary;
    if (!summary) return <NoPreview />;
    const marked = hasPreviewMarker(JSON.stringify([content.values ?? null, summary]));
    return (
      <Block className="rounded-md border border-border bg-card p-4" data-slot="layout-preview-in-app">
        <MarkedCopy marked={marked}>
          <InboxLayoutView layout={layout} values={content.values ?? null} fields={content.fields ?? null} summary={summary} showTitle />
        </MarkedCopy>
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
            fields: { subject: markerText(content.title ?? "") },
            ...(content.html ? { html: replacePreviewMarkers(content.html) } : {}),
            ...(content.text ? { text: markerText(content.text) } : {}),
          },
        ]}
      />
    );
  }
  return content.summary ? (
    <Block className="rounded-md border border-border bg-card p-4" data-slot="layout-preview-summary">
      <SummaryText summary={content.summary} />
    </Block>
  ) : (
    <NoPreview />
  );
}

/**
 * 目印のある中身の写し: children を隠れた所に描き、その HTML の目印を仮の枠に置き換えた写しを見せる(描くたびに写し直す)。
 * React の持つ要素は書き換えない(書き換えると次の描き直しで React と食い違う)。目印が無ければ children をそのまま描く(リンクも押せる)
 */
function MarkedCopy({ marked, children }: { marked: boolean; children: ReactNode }) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!marked || !sourceRef.current || !copyRef.current) return;
    copyRef.current.innerHTML = replacePreviewMarkers(sourceRef.current.innerHTML);
  });
  if (!marked) return <>{children}</>;
  return (
    <>
      <Block ref={sourceRef} hidden aria-hidden data-slot="layout-preview-source">
        {children}
      </Block>
      <Block ref={copyRef} data-slot="layout-preview-copy" />
    </>
  );
}

/** 要約の文(お知らせ以外で描き方の無い経路: LINE など文を送る経路はこれがそのまま送る文) */
function SummaryText({ summary }: { summary: MessageLayoutSummary }) {
  return (
    <Stack gap="2xs">
      <Span weight="semiBold">{markerText(summary.title)}</Span>
      <Para size="sm" className="my-0 whitespace-pre-wrap">
        {markerText(summary.shortBody ?? summary.body)}
      </Para>
      {summary.link ? (
        <Span size="sm" tone="muted">
          {markerText(summary.link.label ?? summary.link.url)}
        </Span>
      ) : null}
    </Stack>
  );
}

function NoPreview() {
  return (
    <Para size="sm" tone="muted" className="my-0">
      この送信方法のプレビューはありません
    </Para>
  );
}
