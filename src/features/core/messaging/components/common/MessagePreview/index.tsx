// src/features/core/messaging/components/common/MessagePreview/index.tsx
// 部品(props だけ): 連絡の経路ごとのプレビュー(送る口が描いた物を見せる)。
// - email: 描いた HTML を sandbox の iframe に出す。HTML が無ければ文(text)、それも無ければ「プレビューはありません」
// - inApp: 受け取り箱の詳細と同じ部品 InboxLayoutView(D120: お知らせの見せ方は 1 つ)。fields が送る口の中身
//   (MessageLayoutContent = ひな形の鍵・差し込み済みの欄の中身・要約)ならひな形の描き方で、それ以前の行(題・本文・画像・行き先)は要約で
// - それ以外の経路: text があればそれ、無ければ欄の値の一覧(欄の名前は見せない、D46)
// 経路の見出しは label(呼び手が経路の表示名を渡す。無ければ経路の鍵)。showLabels false で見出しを出さない(タブで分ける呼び手)
// 使い手: 送る画面の「あなた宛ての表示例」(SampleForYouModal)・回の詳細・ひな形のプレビュー(メールの iframe)

"use client";

import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { isMessageLayoutContent, type MessageLayoutFields } from "@/lib/messaging";

import { messageChannelLabel } from "@/features/core/messaging/constants/channelLabels";

import { InboxLayoutView, inboxSummaryOf } from "../InboxLayoutView";

/** プレビューの経路 1 つ(POST /send/preview の channels の要素と同じ形) */
export type MessagePreviewChannel = {
  key: string;
  label?: string;
  fields: unknown;
  html?: string;
  text?: string;
  /** お知らせの汎用の描き方に使うひな形の欄の宣言(無ければその段を飛ばす) */
  layoutFields?: MessageLayoutFields | null;
};

export type MessagePreviewProps = {
  channels: MessagePreviewChannel[];
  /** メールの iframe の高さ(px、既定 480) */
  emailHeight?: number;
  /** 経路の見出しを出すか(既定 true) */
  showLabels?: boolean;
};

const str = (value: unknown) => (typeof value === "string" ? value : "");
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** お知らせ: 受け取り箱と同じ部品で(送る口の中身ならひな形で、前の行の形なら要約で) */
function InAppView({ channel }: { channel: MessagePreviewChannel }) {
  const fields = channel.fields;
  if (isMessageLayoutContent(fields)) {
    return (
      <Block className="rounded-md border border-border bg-card p-4" data-slot="message-preview-in-app">
        <InboxLayoutView layout={fields.layout} values={fields.values} fields={channel.layoutFields ?? null} summary={fields.summary} showTitle />
      </Block>
    );
  }
  const old = record(fields);
  return (
    <Block className="rounded-md border border-border bg-card p-4" data-slot="message-preview-in-app">
      <InboxLayoutView
        summary={inboxSummaryOf({ title: str(old.title) || null, body: str(old.body), image: str(old.image) || null, link: str(old.link) || null })}
        showTitle
      />
    </Block>
  );
}

function OtherFields({ channel }: { channel: MessagePreviewChannel }) {
  if (channel.text) {
    return (
      <Para size="sm" className="my-0 whitespace-pre-wrap rounded-md border border-border p-3">
        {channel.text}
      </Para>
    );
  }
  // fork の経路の欄: 欄の名前(鍵)は見せず、値だけを「そのほかの欄」として並べる(D46)
  const fields = record(channel.fields);
  return (
    <Stack gap="2xs" className="rounded-md border border-border p-3">
      <Span size="xs" tone="muted">
        その他の項目
      </Span>
      {Object.entries(fields).map(([name, value]) => (
        <Span key={name} size="sm" className="whitespace-pre-wrap">
          {typeof value === "string" ? value : JSON.stringify(value)}
        </Span>
      ))}
    </Stack>
  );
}

export function MessagePreview({ channels, emailHeight = 480, showLabels = true }: MessagePreviewProps) {
  if (channels.length === 0) {
    return (
      <Para size="sm" tone="muted" className="my-0">
        プレビューできる送信方法がありません
      </Para>
    );
  }
  return (
    <Stack gap="md" data-slot="message-preview">
      {channels.map((channel) => (
        <Stack key={channel.key} gap="xs">
          {showLabels ? (
            <Span size="sm" weight="semiBold">
              {channel.label ?? messageChannelLabel(channel.key)}
            </Span>
          ) : null}
          {channel.key === "email" ? (
            channel.html ? (
              // 生の HTML の要素の決まりの例外(.claude/rules/core/components.md「wrappers (raw HTML NG)」): ここだけ生の <iframe> を使う。
              // 理由: 描いたメールの HTML を画面の DOM と分けるため、sandbox を空にした iframe(スクリプト・同じ origin・フォーム・移動を
              // 全部止める)に srcDoc で入れる(指令 28 の答え)。棚(src/components)に iframe の包みは無く、使い手は messaging だけ
              // なので包みは作らない(議長の答え m46)。2 つ目の使い手が出たら src/components に包みを作って移す。
              // lint の規則は <iframe> を見ていないので eslint-disable は付けない(付けると使われていない指示の警告になる)
              <iframe
                title={`${channel.label ?? "メール"}のプレビュー`}
                sandbox=""
                srcDoc={channel.html}
                className="w-full rounded-md border border-border bg-card"
                style={{ height: emailHeight }}
              />
            ) : channel.text ? (
              <Para size="sm" className="my-0 whitespace-pre-wrap rounded-md border border-border p-3">
                {channel.text}
              </Para>
            ) : (
              <Para size="sm" tone="muted" className="my-0">
                このメールのプレビューはありません
              </Para>
            )
          ) : channel.key === "inApp" ? (
            <InAppView channel={channel} />
          ) : (
            <OtherFields channel={channel} />
          )}
        </Stack>
      ))}
    </Stack>
  );
}
