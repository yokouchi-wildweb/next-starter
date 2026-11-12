// src/features/core/messaging/components/common/TemplateChannelFields/index.tsx
// 部品(props だけ): テンプレートの経路 1 つの中身の欄。
// - email: 件名・プレヘッダー・見出し・段落(1 つの欄に書き、空行で区切る)・ボタン(文言・URL)・フッター
// - inApp: 題・本文・画像(アップロード。用途 notification.image、保存の時にサーバーがテンプレートに結ぶ)・行き先
// - line: 本文
// - それ以外(fork の経路): 欄の JSON をそのまま書く(サーバーが経路の欄の zod で検査する)

"use client";

import { useState } from "react";

import { Input, Textarea } from "@/components/Form/Input/Manual";
import { ManualMediaUploader } from "@/components/Form/MediaHandler";
import { Label } from "@/components/Form/Label";
import { Grid } from "@/components/Layout/Grid";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

/** 画像の用途(storage の purpose。お知らせの画像と同じ) */
export const TEMPLATE_IMAGE_PURPOSE = "notification.image";

export type TemplateChannelFieldsProps = {
  /** 経路の鍵 */
  channel: string;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  disabled?: boolean;
};

const str = (value: unknown) => (typeof value === "string" ? value : "");

/** 段落の並び ↔ 空行で区切った文 */
export const paragraphsToText = (value: unknown) => (Array.isArray(value) ? value.map(String).join("\n\n") : "");
export const textToParagraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "");

function TextField({
  id,
  label,
  value,
  onChange,
  rows,
  disabled,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <Stack space={1}>
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      {rows ? (
        <Textarea id={id} value={value} rows={rows} disabled={disabled} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input id={id} value={value} disabled={disabled} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </Stack>
  );
}

function JsonFields({ channel, value, onChange, disabled }: TemplateChannelFieldsProps) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [invalid, setInvalid] = useState(false);
  return (
    <Stack space={1}>
      <Label htmlFor={`template-${channel}-json`} className="text-sm">
        欄(JSON)
      </Label>
      <Textarea
        id={`template-${channel}-json`}
        value={text}
        rows={6}
        disabled={disabled}
        className="font-mono"
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value) as unknown;
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              setInvalid(false);
              onChange(parsed as Record<string, unknown>);
              return;
            }
            setInvalid(true);
          } catch {
            setInvalid(true);
          }
        }}
      />
      {invalid ? (
        <Para size="sm" tone="destructive" className="my-0">
          JSON のオブジェクトとして読めません
        </Para>
      ) : null}
    </Stack>
  );
}

export function TemplateChannelFields(props: TemplateChannelFieldsProps) {
  const { channel, value, onChange, disabled } = props;
  const set = (name: string, next: unknown) => onChange({ ...value, [name]: next });
  const id = (name: string) => `template-${channel}-${name}`;

  if (channel === "email") {
    const cta = (value.cta as { label?: string; url?: string } | undefined) ?? {};
    return (
      <Stack space={3} data-slot="template-channel-fields">
        <TextField id={id("subject")} label="件名" value={str(value.subject)} onChange={(v) => set("subject", v)} disabled={disabled} />
        <TextField id={id("preheader")} label="プレヘッダー(任意)" value={str(value.preheader)} onChange={(v) => set("preheader", v)} disabled={disabled} />
        <TextField id={id("heading")} label="見出し(任意)" value={str(value.heading)} onChange={(v) => set("heading", v)} disabled={disabled} />
        <TextField
          id={id("paragraphs")}
          label="段落(空行で区切る)"
          value={paragraphsToText(value.paragraphs)}
          onChange={(v) => set("paragraphs", textToParagraphs(v))}
          rows={8}
          disabled={disabled}
        />
        <Grid columns="two" gap="sm">
          <TextField id={id("cta-label")} label="ボタンの文言(任意)" value={str(cta.label)} onChange={(v) => set("cta", { ...cta, label: v })} disabled={disabled} />
          <TextField id={id("cta-url")} label="ボタンの URL(任意)" value={str(cta.url)} onChange={(v) => set("cta", { ...cta, url: v })} disabled={disabled} />
        </Grid>
        <TextField id={id("footer")} label="フッター(任意)" value={str(value.footer)} onChange={(v) => set("footer", v)} rows={2} disabled={disabled} />
      </Stack>
    );
  }
  if (channel === "inApp") {
    return (
      <Stack space={3} data-slot="template-channel-fields">
        <TextField id={id("title")} label="題" value={str(value.title)} onChange={(v) => set("title", v)} disabled={disabled} />
        <TextField id={id("body")} label="本文" value={str(value.body)} onChange={(v) => set("body", v)} rows={6} disabled={disabled} />
        <Stack space={1}>
          <Label className="text-sm">画像(任意)</Label>
          <ManualMediaUploader
            purpose={TEMPLATE_IMAGE_PURPOSE}
            value={str(value.image) || null}
            onValueChange={(url) => set("image", url ?? "")}
          />
        </Stack>
        <TextField id={id("link")} label="押したときの行き先(任意)" value={str(value.link)} onChange={(v) => set("link", v)} disabled={disabled} />
      </Stack>
    );
  }
  if (channel === "line") {
    return (
      <Stack space={3} data-slot="template-channel-fields">
        <TextField id={id("text")} label="本文" value={str(value.text)} onChange={(v) => set("text", v)} rows={6} disabled={disabled} />
      </Stack>
    );
  }
  return <JsonFields {...props} />;
}
