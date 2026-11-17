// src/features/core/messaging/components/common/InboxLayoutView/index.tsx
// 部品(props だけ): お知らせ 1 件の中身をひな形で描く(受け取り箱の詳細のモーダルと、管理画面のお知らせのプレビューが同じ部品)。
// 描き方は 1 つ(D120): 1. ひな形のお知らせの描き方(client の一覧 layoutInApps、ひな形の鍵で引く)> 2. 汎用の描き方(欄の宣言 fields
// があれば GenericInAppView)。どちらでも描けない(ひな形・中身が無い = fork がひな形を外した等)時は「このお知らせは表示できません」。
// 要約は描かない(ひな形の描き方に渡すだけ)。
// 題(要約の題 = メールの件名)は既定で描かない(受け取り箱は包む Modal が持つ)。showTitle = 中身の上に見出しで描く(管理画面のお知らせのプレビュー)

import type { ReactNode } from "react";

import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
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
  /** 要約(ひな形のお知らせの描き方に渡す。題は showTitle の見出し) */
  summary: MessageLayoutSummary;
  /** 描けない時の文(既定「このお知らせは表示できません」) */
  unavailableText?: string;
  /** 題(要約の題)を中身の上に見出しで描く(既定 false: 包む Modal・行が題を持つ受け取り箱の画面) */
  showTitle?: boolean;
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

export function InboxLayoutView({ showTitle = false, ...props }: InboxLayoutViewProps) {
  const body = <InboxLayoutBody {...props} />;
  if (!showTitle || !props.summary.title) return body;
  return (
    <Stack gap="sm" data-slot="inbox-layout-titled">
      <SecTitle as="h3" size="lg" data-slot="inbox-layout-title">
        {props.summary.title}
      </SecTitle>
      {body}
    </Stack>
  );
}

function InboxLayoutBody({ layout, values, fields, summary, unavailableText = "このお知らせは表示できません" }: Omit<InboxLayoutViewProps, "showTitle">) {
  if (layout && values) {
    const renderer = layoutInApps[layout];
    if (renderer) {
      const Component = renderer.Component as (props: { values: MessageLayoutValues; summary: MessageLayoutSummary }) => ReactNode;
      return (
        <Stack gap="sm" data-slot="inbox-layout">
          <Component values={values as MessageLayoutValues} summary={summary} />
        </Stack>
      );
    }
    if (fields && Object.keys(fields).length > 0) {
      return <GenericInAppView fields={fields} values={values as MessageLayoutValues} />;
    }
  }
  return (
    <Para tone="muted" className="my-0" data-slot="inbox-layout-unavailable">
      {unavailableText}
    </Para>
  );
}
