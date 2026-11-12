// src/features/core/messaging/components/common/MessagePreview/index.tsx
// 部品(props だけ): 連絡の経路ごとのプレビュー。
// - email: 描いた HTML があればそれを sandbox の iframe に出す。無ければ欄(件名・見出し・段落・ボタン・フッター)から組む
// - inApp: お知らせのカード(画像・題・本文・行き先)
// - それ以外の経路: text があればそれ、無ければ欄の一覧
// 使い手: 送る画面(POST /send/preview の結果)とテンプレートの版の表示(版の欄だけ。HTML は無い)

"use client";

import { AppImage } from "@/components/Media/AppImage";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";

/** プレビューの経路 1 つ(POST /send/preview の channels の要素と同じ形) */
export type MessagePreviewChannel = {
  key: string;
  label?: string;
  fields: unknown;
  html?: string;
  text?: string;
};

export type MessagePreviewProps = {
  channels: MessagePreviewChannel[];
  /** メールの iframe の高さ(px、既定 480) */
  emailHeight?: number;
};

const str = (value: unknown) => (typeof value === "string" ? value : "");
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

function EmailFields({ fields }: { fields: Record<string, unknown> }) {
  const paragraphs = Array.isArray(fields.paragraphs) ? fields.paragraphs.map(String) : [];
  const cta = record(fields.cta);
  return (
    <Stack space={2} className="rounded-md border border-border bg-background p-4">
      <Span size="sm" tone="muted">
        件名: {str(fields.subject)}
      </Span>
      {str(fields.heading) ? (
        <Span size="lg" weight="semiBold">
          {str(fields.heading)}
        </Span>
      ) : null}
      {paragraphs.map((paragraph, index) => (
        <Para key={index} size="sm" className="my-0 whitespace-pre-wrap">
          {paragraph}
        </Para>
      ))}
      {str(cta.label) ? (
        <Span size="sm" className="font-medium">
          [{str(cta.label)}] → {str(cta.url)}
        </Span>
      ) : null}
      {str(fields.footer) ? (
        <Para size="xs" tone="muted" className="my-0 whitespace-pre-wrap">
          {str(fields.footer)}
        </Para>
      ) : null}
    </Stack>
  );
}

function InAppCard({ fields }: { fields: Record<string, unknown> }) {
  return (
    <Stack space={2} className="max-w-md rounded-md border border-border bg-card p-4">
      {str(fields.image) ? (
        <AppImage
          src={str(fields.image)}
          alt={str(fields.title) || "お知らせの画像"}
          sizes="card"
          objectFit="contain"
          className="aspect-video w-full rounded-md bg-muted"
        />
      ) : null}
      <Span weight="semiBold">{str(fields.title)}</Span>
      <Para size="sm" className="my-0 whitespace-pre-wrap break-words">
        {str(fields.body)}
      </Para>
      {str(fields.link) ? (
        <Span size="xs" tone="muted">
          行き先: {str(fields.link)}
        </Span>
      ) : null}
    </Stack>
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
  const fields = record(channel.fields);
  return (
    <Stack space={1} className="rounded-md border border-border p-3">
      {Object.entries(fields).map(([name, value]) => (
        <Span key={name} size="sm" className="whitespace-pre-wrap">
          {name}: {typeof value === "string" ? value : JSON.stringify(value)}
        </Span>
      ))}
    </Stack>
  );
}

export function MessagePreview({ channels, emailHeight = 480 }: MessagePreviewProps) {
  if (channels.length === 0) {
    return (
      <Para size="sm" tone="muted" className="my-0">
        プレビューする経路がありません
      </Para>
    );
  }
  return (
    <Stack space={4} data-slot="message-preview">
      {channels.map((channel) => (
        <Stack key={channel.key} space={2}>
          <Span size="sm" weight="semiBold">
            {channel.label ?? channel.key}
          </Span>
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
            ) : (
              <EmailFields fields={record(channel.fields)} />
            )
          ) : channel.key === "inApp" ? (
            <InAppCard fields={record(channel.fields)} />
          ) : (
            <OtherFields channel={channel} />
          )}
        </Stack>
      ))}
    </Stack>
  );
}
