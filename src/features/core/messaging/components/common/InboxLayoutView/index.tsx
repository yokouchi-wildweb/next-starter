// src/features/core/messaging/components/common/InboxLayoutView/index.tsx
// 部品(props だけ): お知らせ 1 件の中身を描き方の 3 段で描く(受け取り箱の詳しい表示と、管理画面のお知らせのプレビューが同じ部品)。
// 1. ひな形のお知らせの描き方(client の一覧 layoutInApps、ひな形の鍵で引く)
// 2. 汎用の描き方(ひな形の欄の宣言 fields があれば、欄の型ごとに GenericInAppView)
// 3. 要約のカード(画像・本文・行き先のボタン)
// mode "summary" は 1・2 を飛ばして要約だけ(一覧の行・未読のモーダル)。題は描かない(包む Modal・行が持つ)

import type { ReactNode } from "react";

import { LinkButton } from "@/components/Form/Button/LinkButton";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { AppImage } from "@/components/Media/AppImage";
import { Para } from "@/components/TextBlocks/Para";
import type { MessageLayoutFields, MessageLayoutSummary, MessageLayoutValues } from "@/lib/messaging";

import { layoutInApps } from "@/features/core/messaging/extensions/layoutInApps";

import { GenericInAppView } from "./GenericInAppView";

export { GenericInAppView, InboxBlock, type GenericInAppViewProps } from "./GenericInAppView";

export type InboxLayoutViewProps = {
  /** ひな形の鍵(無い = 要約だけ) */
  layout?: string | null;
  /** ひな形の欄の中身(無い = 記録の段が meta・前の行 = 要約だけ) */
  values?: Readonly<Record<string, unknown>> | null;
  /** ひな形のお知らせの欄の宣言(汎用の描き方に要る。無ければ 2 段目を飛ばす) */
  fields?: MessageLayoutFields | null;
  summary: MessageLayoutSummary;
  /** detail = 3 段(既定)/ summary = 要約だけ */
  mode?: "detail" | "summary";
  /** 要約のカードの行き先のボタンの文言(既定「詳しく見る」) */
  linkLabel?: string;
};

/** 受け取り箱の 1 件(要約の欄)→ 要約(題が無い行は空の題) */
export function inboxSummaryOf(item: {
  title: string | null;
  body: string;
  image?: string | null;
  link?: string | null;
}): MessageLayoutSummary {
  return {
    title: item.title ?? "",
    body: item.body,
    ...(item.image ? { image: item.image } : {}),
    ...(item.link ? { link: { url: item.link } } : {}),
  };
}

/** 要約のカード(3 段目): 画像・本文・行き先 */
export function InboxSummaryCard({ summary, linkLabel = "詳しく見る" }: { summary: MessageLayoutSummary; linkLabel?: string }) {
  return (
    <Stack space={3} data-slot="inbox-summary">
      {summary.image ? (
        <AppImage
          src={summary.image}
          alt={summary.title || "お知らせの画像"}
          sizes="card"
          objectFit="contain"
          className="aspect-video w-full rounded-md bg-muted"
        />
      ) : null}
      <Para className="whitespace-pre-wrap break-words">{summary.body}</Para>
      {summary.link ? (
        <Flex justify="center">
          <LinkButton href={summary.link.url} variant="outline">
            {summary.link.label ?? linkLabel}
          </LinkButton>
        </Flex>
      ) : null}
    </Stack>
  );
}

export function InboxLayoutView({ layout, values, fields, summary, mode = "detail", linkLabel }: InboxLayoutViewProps) {
  if (mode === "detail" && layout && values) {
    const renderer = layoutInApps[layout];
    if (renderer) {
      const Component = renderer.Component as (props: { values: MessageLayoutValues; summary: MessageLayoutSummary }) => ReactNode;
      return (
        <Stack space={3} data-slot="inbox-layout">
          <Component values={values as MessageLayoutValues} summary={summary} />
        </Stack>
      );
    }
    if (fields && Object.keys(fields).length > 0) {
      return <GenericInAppView fields={fields} values={values as MessageLayoutValues} />;
    }
  }
  return <InboxSummaryCard summary={summary} linkLabel={linkLabel} />;
}
