// src/features/core/messaging/components/common/OverrideFieldEditor/index.tsx
// 部品(props だけ): 文言の欄 1 つの編集(欄 = ひな形の欄、D132)。入力は欄の宣言の型で部品 LayoutFieldInput が描く
// (1 行の文・段落・長い文・画像・ボタン・リンク・日付・数・選択肢・並び・組・項目と値・ブロックの並び)。
// 欄に入ると onFocusField(プレビューの枠、D80)。
// 印(OverrideFieldMarks: 直した・コードが変わった・使えない・直せなくなった・未保存)・使えない理由・知らない {{鍵}}・
// コードの値(元の文言。同じ入力の部品で読むだけに描く。直した欄は開いておき、直していない欄は開け閉め)・保存 / 入力を破棄 / 元の文言に戻す。
// 直せなくなった欄は元の文言に戻すだけ。ひな形に無い欄の行(宣言が無い)は保存した値を文字で見せる

"use client";

import { useState } from "react";

import { Button } from "@/components/Form/Button";
import { Label } from "@/components/Form/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { ConfirmPopover } from "@/components/Overlays/Popover";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import type { MessageFieldShape } from "@/lib/messaging";

import type { OverrideFieldValue } from "@/features/core/messaging/hooks/useMessageOverrideEditor";
import type { AdminOverrideField } from "@/features/core/messaging/services/client/overrideClient";

import { EmbeddedInfoTags } from "../EmbeddedInfoTags";
import { LayoutFieldInput } from "../LayoutFields";
import { OverrideFieldMarks } from "../OverrideFieldMarks";

/** 1 行の欄か(改行を入れない、D78) */
export function isSingleLineOverrideField(field: Pick<AdminOverrideField, "spec">): boolean {
  return field.spec?.type === "line";
}

/** 欄の見出し(宣言の見出し、無ければ欄の鍵) */
export function overrideFieldLabel(field: Pick<AdminOverrideField, "spec" | "path">): string {
  return field.spec?.label ?? field.path;
}

/** 値を読む形に(段落は空行で区切る。宣言の無い行だけが使う) */
function asText(value: unknown): string {
  if (Array.isArray(value)) return value.map(asText).join("\n\n");
  if (value && typeof value === "object") return Object.values(value).map(asText).filter(Boolean).join(" / ");
  return value === null || value === undefined ? "" : String(value);
}

const NOOP = () => {};

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
  /** 欄に入った時("<欄>[.<部分>|.<番号>]") */
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
  // 欄の宣言は型の和(MessageFieldShape)に見出しなどを足した物。経路の印を除いた型なので入力の形として読む
  const shape = field.spec ? (field.spec as unknown as MessageFieldShape) : null;
  const [codeOpen, setCodeOpen] = useState(false);
  const showCode = field.edited || codeOpen;
  return (
    <Stack space={3} className="rounded-md border border-border bg-card p-4" data-slot="override-field-editor">
      <Flex align="center" justify="between" gap="sm" wrap="wrap">
        <Label htmlFor={id} className="text-sm font-medium">
          {overrideFieldLabel(field)}
        </Label>
        <OverrideFieldMarks field={field} dirty={dirty} />
      </Flex>

      {field.unusable && field.problem ? (
        <Para size="sm" tone="destructive" className="my-0">
          {field.problem}
        </Para>
      ) : null}

      {shape && field.editable ? (
        <LayoutFieldInput
          id={id}
          path={field.path}
          shape={shape}
          value={value}
          onChange={onChange}
          placeholder={field.spec?.placeholder}
          onFocusField={onFocusField}
        />
      ) : (
        <Para size="sm" tone="muted" className="my-0 whitespace-pre-wrap">
          {asText(field.value) || "-"}
        </Para>
      )}

      {unknownKeys.length > 0 ? <EmbeddedInfoTags common={[]} own={[]} unknownNames={unknownKeys} showTitle={false} /> : null}

      {shape ? (
        <Stack space={1} data-slot="override-field-code">
          <Flex align="center" gap="xs">
            <Span size="xs" tone="muted">
              元の文言
            </Span>
            {!field.edited ? (
              <Button type="button" size="xs" variant="ghost" onClick={() => setCodeOpen((open) => !open)}>
                {codeOpen ? "閉じる" : "表示"}
              </Button>
            ) : null}
          </Flex>
          {showCode ? (
            <Stack space={1} className="rounded bg-muted/40 p-2">
              <LayoutFieldInput id={`${id}-code`} path={field.path} shape={shape} value={field.codeValue ?? ""} onChange={NOOP} readOnly />
            </Stack>
          ) : null}
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
        {shape && field.editable ? (
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
