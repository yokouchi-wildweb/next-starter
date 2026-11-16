// src/features/core/messaging/components/common/ChannelPreview/index.tsx
// 部品(props だけ): 編集中の経路 1 つのプレビュー(D80 の左の欄)。入力中の欄(focusedPath)の場所を枠で示す。
// - email: 受信一覧の 1 行(件名・プレヘッダー)+ 描いたメール(html があれば。文言の編集のプレビュー API の HTML で、欄に data-field の印)。
//   枠は HTML に [data-field] の style を足して付ける(iframe は MessagePreview の物を使う)。html が無ければ欄から組んだ形
// - inApp: お知らせの一覧のカードと開いた時の表示 / line: トークの吹き出し
// - previewComponent の鍵が受け口 channelPreviews にあればその部品(fork の経路)、無ければ欄の値を見出し付きで並べる

"use client";

import type { ReactNode } from "react";

import { AppImage } from "@/components/Media/AppImage";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import type { ChannelFieldMeta } from "@/lib/messaging";
import { cn } from "@/lib/cn";

import { channelPreviews } from "@/features/core/messaging/extensions/channelPreviews";

import { MessagePreview } from "../MessagePreview";

export type ChannelPreviewProps = {
  channel: { key: string; label: string; previewComponent?: string | null };
  /** 経路の欄の値(未保存の値を重ねた物) */
  values: Readonly<Record<string, unknown>>;
  fieldMeta: Readonly<Record<string, ChannelFieldMeta>>;
  /** 入力中の欄("<経路>.<欄>[.<部分>]") */
  focusedPath?: string | null;
  /** 描いたメールの HTML(文言の編集のプレビュー API。無ければ欄から組む) */
  html?: string | null;
  /** HTML を描き直している間 */
  loading?: boolean;
};

const str = (value: unknown) => (typeof value === "string" ? value : "");
const FOCUS_RING = "rounded-sm ring-2 ring-warning ring-offset-2";

/** 欄 path に入力中か(部分の欄も、その欄の入力中に含める) */
export function isFocusedField(focusedPath: string | null | undefined, path: string): boolean {
  if (!focusedPath) return false;
  return focusedPath === path || focusedPath.startsWith(`${path}.`) || path.startsWith(`${focusedPath}.`);
}

/** 描いた HTML に入力中の欄の枠の style を足す(data-field の印に当てる) */
export function withFocusStyle(html: string, focusedPath: string | null | undefined): string {
  if (!focusedPath) return html;
  const value = focusedPath.replace(/["\\]/g, "");
  const style = `<style>[data-field="${value}"],[data-field^="${value}."]{outline:2px solid #f59e0b;outline-offset:2px;border-radius:2px}</style>`;
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${style}</head>`) : `${style}${html}`;
}

function Marked({ path, focusedPath, children, className }: { path: string; focusedPath?: string | null; children: ReactNode; className?: string }) {
  return (
    <Span data-field={path} className={cn(className, isFocusedField(focusedPath, path) && FOCUS_RING)}>
      {children}
    </Span>
  );
}

function EmailPreview({ channel, values, focusedPath, html, loading }: ChannelPreviewProps) {
  return (
    <Stack space={3}>
      <Stack space={1} className="rounded-md border border-border bg-card p-3">
        <Span size="xs" tone="muted">
          受信一覧での表示
        </Span>
        <Marked path={`${channel.key}.subject`} focusedPath={focusedPath} className="font-semibold">
          {str(values.subject) || "(件名なし)"}
        </Marked>
        {str(values.preheader) ? (
          <Marked path={`${channel.key}.preheader`} focusedPath={focusedPath} className="text-sm text-muted-foreground">
            {str(values.preheader)}
          </Marked>
        ) : null}
      </Stack>
      {loading && !html ? (
        <Flex justify="center" className="py-8">
          <Spinner className="size-6" />
        </Flex>
      ) : (
        <MessagePreview
          channels={[{ key: "email", label: channel.label, fields: values, ...(html ? { html: withFocusStyle(html, focusedPath) } : {}) }]}
          emailHeight={520}
        />
      )}
    </Stack>
  );
}

function InAppPreview({ channel, values, focusedPath }: ChannelPreviewProps) {
  const image = str(values.image);
  return (
    <Stack space={3}>
      <Span size="xs" tone="muted">
        お知らせの一覧
      </Span>
      <Flex gap="sm" align="start" className="rounded-md border border-border bg-card p-3">
        {image ? (
          <Marked path={`${channel.key}.image`} focusedPath={focusedPath}>
            <AppImage src={image} alt="お知らせの画像" sizes="card" objectFit="cover" className="size-12 rounded" />
          </Marked>
        ) : null}
        <Stack space={1} className="min-w-0">
          <Marked path={`${channel.key}.title`} focusedPath={focusedPath} className="truncate font-semibold">
            {str(values.title) || "(タイトルなし)"}
          </Marked>
          <Marked path={`${channel.key}.body`} focusedPath={focusedPath} className="line-clamp-2 text-sm text-muted-foreground">
            {str(values.body)}
          </Marked>
        </Stack>
      </Flex>
      <Span size="xs" tone="muted">
        開いた時
      </Span>
      <Stack space={2} className="rounded-md border border-border bg-card p-4">
        {image ? (
          <Marked path={`${channel.key}.image`} focusedPath={focusedPath}>
            <AppImage src={image} alt="お知らせの画像" sizes="card" objectFit="contain" className="aspect-video w-full rounded-md bg-muted" />
          </Marked>
        ) : null}
        <Marked path={`${channel.key}.title`} focusedPath={focusedPath} className="text-lg font-semibold">
          {str(values.title) || "(タイトルなし)"}
        </Marked>
        <Marked path={`${channel.key}.body`} focusedPath={focusedPath} className="whitespace-pre-wrap text-sm">
          {str(values.body)}
        </Marked>
        {str(values.link) ? (
          <Marked path={`${channel.key}.link`} focusedPath={focusedPath} className="text-sm text-info-text underline">
            {str(values.link)}
          </Marked>
        ) : null}
      </Stack>
    </Stack>
  );
}

function LinePreview({ channel, values, focusedPath }: ChannelPreviewProps) {
  return (
    <Stack space={2} className="rounded-md border border-border bg-muted/40 p-4">
      <Span size="xs" tone="muted">
        トークでの表示
      </Span>
      <Flex>
        <Marked
          path={`${channel.key}.text`}
          focusedPath={focusedPath}
          className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-card px-4 py-2 text-sm shadow-sm"
        >
          {str(values.text) || "(本文なし)"}
        </Marked>
      </Flex>
    </Stack>
  );
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(asText).join("\n");
  if (value && typeof value === "object") return Object.values(value).map(asText).filter(Boolean).join(" / ");
  return value === null || value === undefined ? "" : String(value);
}

function LabelledPreview({ channel, values, fieldMeta, focusedPath }: ChannelPreviewProps) {
  const keys = [...Object.keys(fieldMeta), ...Object.keys(values).filter((key) => !(key in fieldMeta))];
  return (
    <Stack space={2} className="rounded-md border border-border bg-card p-4">
      {keys.map((key) => (
        <Stack key={key} space={0}>
          <Span size="xs" tone="muted">
            {fieldMeta[key]?.label ?? key}
          </Span>
          <Marked path={`${channel.key}.${key}`} focusedPath={focusedPath} className="whitespace-pre-wrap text-sm">
            {asText(values[key]) || "-"}
          </Marked>
        </Stack>
      ))}
    </Stack>
  );
}

export function ChannelPreview(props: ChannelPreviewProps) {
  const { channel } = props;
  const forkPreview = channel.previewComponent ? channelPreviews[channel.previewComponent] : undefined;
  return (
    <Stack space={2} data-slot="channel-preview">
      {forkPreview ? (
        <forkPreview.Component values={props.values} fieldMeta={props.fieldMeta} focusedPath={props.focusedPath ?? null} />
      ) : channel.key === "email" ? (
        <EmailPreview {...props} />
      ) : channel.key === "inApp" ? (
        <InAppPreview {...props} />
      ) : channel.key === "line" ? (
        <LinePreview {...props} />
      ) : (
        <LabelledPreview {...props} />
      )}
      <Para size="xs" tone="muted" className="my-0">
        {"{{変数名}}"} は送信時に実際の値に置き換わります
      </Para>
    </Stack>
  );
}
