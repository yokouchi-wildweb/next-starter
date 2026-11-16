// src/features/core/messaging/components/common/ChannelFields/index.tsx
// 部品(props だけ): 経路 1 つの欄を、経路の受け口の欄の表示の約束(fieldMeta、D83)から並べる。
// 文言の編集・テンプレート・送るモーダルが同じ部品を使う(手で書いた経路ごとの欄・JSON の欄は無い)。
// - input line / url = 1 行(改行は空白に、D78)、text = 複数行、select = 選択肢、image = 画像のアップロード(用途 notification.image)
// - list = 値が並び(1 つずつの欄 + 足す・消す)、parts = 値が object(鍵ごとの欄)
// - 約束の無い欄(値にだけある鍵)は欄の名前を見出しに 1 行
// - 欄に入ると onFocusField("<経路>.<欄>[.<部分>]")(プレビューがその場所を枠で示す、D80)

"use client";

import { Button } from "@/components/Form/Button";
import { Input, SelectInput, Textarea } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { ManualMediaUploader } from "@/components/Form/MediaHandler";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks/Span";
import type { ChannelFieldMeta } from "@/lib/messaging";

/** 画像の用途(storage の purpose。お知らせ・テンプレート・文言の編集の画像は同じ) */
export const CHANNEL_IMAGE_PURPOSE = "notification.image";

/** 1 行の欄の値(改行を空白にする、D78) */
export const oneLine = (value: string) => value.replace(/\r?\n/g, " ");

const str = (value: unknown) => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value));

export type ChannelFieldInputProps = {
  /** 欄の id(label の htmlFor) */
  id: string;
  /** "<経路>.<欄>[.<部分>]" */
  path: string;
  meta: ChannelFieldMeta;
  value: unknown;
  onChange: (value: unknown) => void;
  onFocusField?: (path: string) => void;
  disabled?: boolean;
};

/** 欄 1 つの入力(見出しは呼び手) */
export function ChannelFieldInput({ id, path, meta, value, onChange, onFocusField, disabled }: ChannelFieldInputProps) {
  const focus = () => onFocusField?.(path);
  if (meta.parts) {
    const object = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    return (
      <Stack space={2} className="rounded-md border border-border p-3">
        {Object.entries(meta.parts).map(([key, partMeta]) => (
          <ChannelField
            key={key}
            id={`${id}-${key}`}
            path={`${path}.${key}`}
            meta={partMeta}
            value={object[key]}
            onChange={(next) => onChange({ ...object, [key]: next })}
            onFocusField={onFocusField}
            disabled={disabled}
          />
        ))}
      </Stack>
    );
  }
  if (meta.list) {
    const items = Array.isArray(value) ? value.map(str) : [];
    const single = meta.input === "line" || meta.input === "url";
    return (
      <Stack space={2}>
        {items.map((item, index) => (
          <Flex key={index} align="start" gap="xs">
            {single ? (
              <Input
                id={index === 0 ? id : `${id}-${index}`}
                value={item}
                disabled={disabled}
                onFocus={focus}
                onChange={(e) => onChange(items.map((v, i) => (i === index ? oneLine(e.target.value) : v)))}
              />
            ) : (
              <Textarea
                id={index === 0 ? id : `${id}-${index}`}
                value={item}
                rows={3}
                disabled={disabled}
                onFocus={focus}
                onChange={(e) => onChange(items.map((v, i) => (i === index ? e.target.value : v)))}
              />
            )}
            <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onChange(items.filter((_, i) => i !== index))}>
              削除
            </Button>
          </Flex>
        ))}
        <Flex>
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onChange([...items, ""])}>
            追加
          </Button>
        </Flex>
      </Stack>
    );
  }
  switch (meta.input) {
    case "text":
      return <Textarea id={id} value={str(value)} rows={4} disabled={disabled} onFocus={focus} onChange={(e) => onChange(e.target.value)} />;
    case "select":
      return (
        <SelectInput
          id={id}
          value={str(value)}
          options={(meta.options ?? []).map((option) => ({ value: option.value, label: option.label }))}
          disabled={disabled}
          onChange={(v) => onChange(v ? String(v) : "")}
        />
      );
    case "image":
      return (
        <ManualMediaUploader
          purpose={CHANNEL_IMAGE_PURPOSE}
          value={str(value) || null}
          onValueChange={(url) => {
            focus();
            onChange(url ?? "");
          }}
        />
      );
    case "url":
      return <Input id={id} type="url" value={str(value)} disabled={disabled} onFocus={focus} onChange={(e) => onChange(oneLine(e.target.value).trim())} />;
    default:
      return <Input id={id} value={str(value)} disabled={disabled} onFocus={focus} onChange={(e) => onChange(oneLine(e.target.value))} />;
  }
}

/** 見出し・説明付きの欄 1 つ */
export function ChannelField(props: ChannelFieldInputProps) {
  const { id, meta } = props;
  return (
    <Stack space={1} data-slot="channel-field">
      <Label htmlFor={id} className="text-sm">
        {meta.label}
      </Label>
      {meta.help ? (
        <Span size="xs" tone="muted">
          {meta.help}
        </Span>
      ) : null}
      <ChannelFieldInput {...props} />
    </Stack>
  );
}

export type ChannelFieldsProps = {
  /** 経路の鍵 */
  channel: string;
  /** 経路の欄の表示の約束(選択肢・文言の編集の API が返す) */
  fieldMeta: Readonly<Record<string, ChannelFieldMeta>>;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  onFocusField?: (path: string) => void;
  disabled?: boolean;
};

/** 経路 1 つの欄の全部(約束の順、約束の無い値の鍵は後ろに 1 行で) */
export function ChannelFields({ channel, fieldMeta, value, onChange, onFocusField, disabled }: ChannelFieldsProps) {
  const extra = Object.keys(value).filter((key) => !(key in fieldMeta));
  const entries: [string, ChannelFieldMeta][] = [
    ...Object.entries(fieldMeta),
    ...extra.map((key): [string, ChannelFieldMeta] => [key, { label: key, input: "line" }]),
  ];
  return (
    <Stack space={3} data-slot="channel-fields">
      {entries.map(([field, meta]) => (
        <ChannelField
          key={field}
          id={`channel-${channel}-${field}`}
          path={`${channel}.${field}`}
          meta={meta}
          value={value[field]}
          onChange={(next) => onChange({ ...value, [field]: next })}
          onFocusField={onFocusField}
          disabled={disabled}
        />
      ))}
    </Stack>
  );
}
