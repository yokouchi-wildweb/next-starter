// src/features/core/messaging/components/common/OverrideFieldEditor/index.tsx
// 部品(props だけ): 文言の欄 1 つの編集。文字の欄 = Textarea 1 つ、段落の欄 = 段落ごとの Textarea(数はコードのまま)。
// 印・知らない {{鍵}}・直したときのコードの値・保存 / 下書きを捨てる / 既定に戻す。直せなくなった欄は既定に戻すだけ

"use client";

import { Button } from "@/components/Form/Button";
import { Textarea } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { ConfirmPopover } from "@/components/Overlays/Popover";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";

import type { OverrideFieldValue } from "@/features/core/messaging/hooks/useMessageOverrideEditor";
import type { AdminOverrideField } from "@/features/core/messaging/services/client/overrideClient";

import { messageChannelLabel } from "@/features/core/messaging/constants/channelLabels";

import { AllowedKeysHint } from "../AllowedKeysHint";
import { OverrideFieldMarks } from "../OverrideFieldMarks";

const FIELD_LABELS: Record<string, string> = {
  subject: "件名",
  heading: "見出し",
  paragraphs: "段落",
  title: "題",
  body: "本文",
  preheader: "プレヘッダー",
};

/** "<経路>.<欄>" → 表示名(知らない名前はそのまま) */
export function overrideFieldLabel(path: string): string {
  const [channel, ...rest] = path.split(".");
  const name = rest.join(".");
  if (!name) return path;
  return `${messageChannelLabel(channel)} / ${FIELD_LABELS[name] ?? name}`;
}

/** 値を読む形に(段落は空行で区切る) */
function asText(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => String(v ?? "")).join("\n\n");
  return value === null || value === undefined ? "" : String(value);
}

export type OverrideFieldEditorProps = {
  field: AdminOverrideField;
  value: OverrideFieldValue;
  onChange: (value: OverrideFieldValue) => void;
  dirty: boolean;
  /** 下書きの中の知らない {{鍵}} */
  unknownKeys: readonly string[];
  onSave: () => Promise<void>;
  onReset: () => Promise<void>;
  onDiscard: () => void;
};

export function OverrideFieldEditor({
  field,
  value,
  onChange,
  dirty,
  unknownKeys,
  onSave,
  onReset,
  onDiscard,
}: OverrideFieldEditorProps) {
  const id = `override-${field.path.replace(/[^a-zA-Z0-9]/g, "-")}`;
  return (
    <Stack space={3} className="rounded-md border border-border bg-card p-4" data-slot="override-field-editor">
      <Flex align="center" justify="between" gap="sm" wrap="wrap">
        <Label htmlFor={id} className="text-sm font-medium">
          {overrideFieldLabel(field.path)}
        </Label>
        <OverrideFieldMarks field={field} dirty={dirty} />
      </Flex>

      {field.orphan && field.problem ? (
        <Para size="sm" tone="destructive" className="my-0">
          {field.problem}
        </Para>
      ) : null}

      {field.editable ? (
        Array.isArray(value) ? (
          <Stack space={2}>
            {value.map((paragraph, index) => (
              <Stack key={index} space={1}>
                <Span size="xs" tone="muted">
                  段落 {index + 1}
                </Span>
                <Textarea
                  id={index === 0 ? id : `${id}-${index}`}
                  value={paragraph}
                  rows={3}
                  onChange={(e) => onChange(value.map((p, i) => (i === index ? e.target.value : p)))}
                />
              </Stack>
            ))}
          </Stack>
        ) : (
          <Textarea id={id} value={value} rows={field.path.endsWith(".subject") || field.path.endsWith(".title") ? 2 : 4} onChange={(e) => onChange(e.target.value)} />
        )
      ) : (
        <Para size="sm" tone="muted" className="my-0 whitespace-pre-wrap">
          {asText(field.value)}
        </Para>
      )}

      {unknownKeys.length > 0 ? <AllowedKeysHint allowedKeys={[]} unknownKeys={unknownKeys} showTitle={false} /> : null}

      {field.edited ? (
        <Stack space={1}>
          <Span size="xs" tone="muted">
            コードの値
          </Span>
          <Para size="sm" tone="muted" className="my-0 whitespace-pre-wrap rounded bg-muted/40 p-2">
            {asText(field.codeValue)}
          </Para>
        </Stack>
      ) : null}

      <Flex justify="end" gap="xs" wrap="wrap">
        {dirty ? (
          <Button type="button" size="sm" variant="ghost" onClick={onDiscard}>
            下書きを捨てる
          </Button>
        ) : null}
        {field.edited ? (
          <ConfirmPopover
            trigger={
              <Button type="button" size="sm" variant="outline">
                既定に戻す
              </Button>
            }
            title="既定に戻す"
            description="この欄の管理画面の値を消し、コードの値で送ります。"
            confirmLabel="戻す"
            onConfirm={onReset}
          />
        ) : null}
        {field.editable ? (
          <ConfirmPopover
            trigger={
              <Button type="button" size="sm" variant="primary" disabled={!dirty || unknownKeys.length > 0}>
                保存
              </Button>
            }
            title="保存"
            description="次に送る連絡からこの文言で送ります。"
            confirmLabel="保存する"
            onConfirm={onSave}
          />
        ) : null}
      </Flex>
    </Stack>
  );
}
