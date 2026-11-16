// src/features/core/messaging/components/common/OverrideFieldEditor/index.tsx
// 部品(props だけ): 文言の欄 1 つの編集。入力は欄の表示の約束(field.meta、D83)から ChannelFieldInput が描く
// (1 行・複数行・URL・選択・画像・並び・部分)。欄に入ると onFocusField(プレビューの枠、D80)。
// 印・知らない {{鍵}}・直したときのコードの値・保存 / 下書きを捨てる / 既定に戻す。直せなくなった欄は既定に戻すだけ

"use client";

import { Button } from "@/components/Form/Button";
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
import { ChannelFieldInput } from "../ChannelFields";
import { OverrideFieldMarks } from "../OverrideFieldMarks";

const FIELD_LABELS: Record<string, string> = {
  subject: "件名",
  heading: "見出し",
  paragraphs: "段落",
  title: "タイトル",
  body: "本文",
  preheader: "プレヘッダー",
};

/** "<経路>.<欄>" → 表示名(知らない名前はそのまま) */
const SINGLE_LINE_NAMES = new Set(["subject", "preheader", "heading", "title", "label", "url", "link"]);

/** 一行の欄か(件名・プレヘッダー・見出し・タイトル・ボタンの文言・URL。改行を入れない、D78) */
export function isSingleLineOverrideField(path: string): boolean {
  return SINGLE_LINE_NAMES.has(path.split(".").pop() ?? "");
}

export function overrideFieldLabel(path: string): string {
  const [channel, ...rest] = path.split(".");
  const name = rest.join(".");
  if (!name) return path;
  return `${messageChannelLabel(channel)} / ${FIELD_LABELS[name] ?? name}`;
}

/** 値を読む形に(段落は空行で区切る) */
function asText(value: unknown): string {
  if (Array.isArray(value)) return value.map(asText).join("\n\n");
  if (value && typeof value === "object") return Object.values(value).map(asText).filter(Boolean).join(" / ");
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
  /** 欄に入った時("<経路>.<欄>[.<部分>]") */
  onFocusField?: (path: string) => void;
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
  onFocusField,
}: OverrideFieldEditorProps) {
  const id = `override-${field.path.replace(/[^a-zA-Z0-9]/g, "-")}`;
  return (
    <Stack space={3} className="rounded-md border border-border bg-card p-4" data-slot="override-field-editor">
      <Flex align="center" justify="between" gap="sm" wrap="wrap">
        <Label htmlFor={id} className="text-sm font-medium">
          {field.meta?.label ?? overrideFieldLabel(field.path)}
        </Label>
        <OverrideFieldMarks field={field} dirty={dirty} />
      </Flex>
      {field.meta?.help ? (
        <Span size="xs" tone="muted">
          {field.meta.help}
        </Span>
      ) : null}

      {field.orphan && field.problem ? (
        <Para size="sm" tone="destructive" className="my-0">
          {field.problem}
        </Para>
      ) : null}

      {field.editable ? (
        <ChannelFieldInput
          id={id}
          path={field.path}
          meta={field.meta}
          value={value}
          onChange={(next) => onChange(next as OverrideFieldValue)}
          onFocusField={onFocusField}
        />
      ) : (
        <Para size="sm" tone="muted" className="my-0 whitespace-pre-wrap">
          {asText(field.value)}
        </Para>
      )}

      {unknownKeys.length > 0 ? <AllowedKeysHint allowedKeys={[]} unknownKeys={unknownKeys} showTitle={false} /> : null}

      {field.edited ? (
        <Stack space={1}>
          <Span size="xs" tone="muted">
            元の文言
          </Span>
          <Para size="sm" tone="muted" className="my-0 whitespace-pre-wrap rounded bg-muted/40 p-2">
            {asText(field.codeValue)}
          </Para>
        </Stack>
      ) : null}

      <Flex justify="end" gap="xs" wrap="wrap">
        {dirty ? (
          <Button type="button" size="sm" variant="ghost" onClick={onDiscard}>
            入力を破棄
          </Button>
        ) : null}
        {field.edited ? (
          <ConfirmPopover
            trigger={
              <Button type="button" size="sm" variant="outline">
                元の文言に戻す
              </Button>
            }
            title="元の文言に戻す"
            description="この項目で編集した文言を削除し、元の文言で送信します。"
            confirmLabel="元に戻す"
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
            description="次に送信する通知から、この文言で送信します。"
            confirmLabel="保存する"
            onConfirm={onSave}
          />
        ) : null}
      </Flex>
    </Stack>
  );
}
