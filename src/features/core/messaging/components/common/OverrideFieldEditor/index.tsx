// src/features/core/messaging/components/common/OverrideFieldEditor/index.tsx
// 部品(props だけ): 文言の欄 1 つの編集(欄 = ひな形の欄、D132)。入力は欄の宣言の型で部品 LayoutFieldInput が描く
// (1行テキスト・段落・複数行テキスト・画像・ボタン・リンク・日付・数・選択肢・並び・組・ラベルと値・ブロックの並び)。
// 欄に入ると onFocusField(プレビューの枠、D80)。
// 印(OverrideFieldMarks: 直した・コードが変わった・使えない・直せなくなった・未保存)・使えない理由・知らない {{鍵}}・
// コードの値(元の文言。同じ入力の部品で読むだけに描く。直した欄は開いておき、直していない欄は開け閉め)・保存の誤り(error)・元の文言に戻す。
// 保存はモーダルの下の帯の 1 回だけ(D132)。欄の操作は「元の文言に戻す」だけ: 保存してある欄は確かめて戻す印(onReset、保存で消える。印 resetPending)、
// 下書きだけの欄は下書きを捨てる。直せなくなった欄も元の文言に戻すだけ。ひな形に無い欄の行(宣言が無い)は保存した値を文字で見せる。
// 見せる値の {{鍵}} → {{別名}}(D133)は呼び手が直した値で渡す(value・codeValue・unknownKeys)

"use client";

import { useState } from "react";

import { SoftBadge } from "@/components/Badge";
import { Button } from "@/components/Form/Button";
import { Label } from "@/components/Form/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { ConfirmPopover } from "@/components/Overlays/Popover";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import type { MessageFieldShape } from "@/lib/messaging";

import { messageChannelLabel } from "@/features/core/messaging/constants/channelLabels";
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
  /** 元の文言に戻す(保存してある欄は戻す印、下書きだけの欄は下書きを捨てる。保存はモーダルの 1 回) */
  onReset: () => void;
  /** 戻す印がある(保存すると元の文言に戻る) */
  resetPending?: boolean;
  /** 保存の誤り(まとめての保存で、この欄が通らなかった理由) */
  error?: string | null;
  /** 欄に入った時("<欄>[.<部分>|.<番号>]") */
  onFocusField?: (path: string) => void;
  /**
   * 経路の印(D117): true = 「全経路で共通」、false = 「<経路>だけ」(field.channels)、省略 = 印なし。
   * 呼び手が連絡の経路の全部と field.channels を比べて決める
   */
  commonToAll?: boolean;
  /** 元の文言として見せる値(呼び手が {{鍵}} を別名にした物)。省略 = field.codeValue */
  codeValue?: OverrideFieldValue;
};

export function OverrideFieldEditor({
  field,
  value,
  onChange,
  dirty,
  unknownKeys,
  onReset,
  resetPending = false,
  error = null,
  onFocusField,
  commonToAll,
  codeValue,
}: OverrideFieldEditorProps) {
  const id = `override-${field.path.replace(/[^a-zA-Z0-9]/g, "-")}`;
  // 欄の宣言は型の和(MessageFieldShape)に見出しなどを足した物。経路の印を除いた型なので入力の形として読む
  const shape = field.spec ? (field.spec as unknown as MessageFieldShape) : null;
  const [codeOpen, setCodeOpen] = useState(false);
  const showCode = field.edited || codeOpen;
  return (
    <Stack gap="sm" className="rounded-md border border-border bg-card p-4" data-slot="override-field-editor">
      <Flex align="center" justify="between" gap="md" wrap="wrap">
        <Flex align="center" gap="xs" wrap="wrap">
          <Label htmlFor={id} className="text-sm font-medium">
            {overrideFieldLabel(field)}
          </Label>
          {commonToAll === true ? (
            <SoftBadge variant="outline" size="sm" data-slot="override-field-common-mark">
              全経路で共通
            </SoftBadge>
          ) : commonToAll === false && field.channels.length > 0 ? (
            <SoftBadge variant="secondary" size="sm" data-slot="override-field-channel-mark">
              {field.channels.map(messageChannelLabel).join("・")}だけ
            </SoftBadge>
          ) : null}
        </Flex>
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

      {resetPending ? (
        <SoftBadge variant="warning" size="sm" data-slot="override-field-reset-pending">
          保存すると元の文言に戻ります
        </SoftBadge>
      ) : null}
      {error ? (
        <Para size="sm" tone="destructive" className="my-0" data-slot="override-field-error">
          {error}
        </Para>
      ) : null}
      {unknownKeys.length > 0 ? <EmbeddedInfoTags common={[]} own={[]} unknownNames={unknownKeys} showTitle={false} /> : null}

      {shape ? (
        <Stack gap="2xs" data-slot="override-field-code">
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
            <Stack gap="2xs" className="rounded bg-muted/40 p-2">
              <LayoutFieldInput id={`${id}-code`} path={field.path} shape={shape} value={(codeValue === undefined ? field.codeValue : codeValue) ?? ""} onChange={NOOP} readOnly />
            </Stack>
          ) : null}
        </Stack>
      ) : null}

      <Flex justify="end" gap="xs" wrap="wrap">
        {field.edited && !resetPending ? (
          <ConfirmPopover
            trigger={
              <Button type="button" size="sm" variant="outline">
                元の文言に戻す
              </Button>
            }
            title="元の文言に戻す"
            description="保存すると、この項目で編集した文言を削除し、元の文言で送信します。"
            confirmLabel="元に戻す"
            onConfirm={onReset}
          />
        ) : dirty && !resetPending ? (
          <Button type="button" size="sm" variant="outline" onClick={onReset}>
            元の文言に戻す
          </Button>
        ) : null}
      </Flex>
    </Stack>
  );
}
