// src/domains/core/messaging/components/common/LayoutFields/index.tsx
// 部品(props だけ): レイアウトの欄の宣言(D123)から入力を並べる。react-hook-form の control と欄の場所(name)に結ぶ
// (フォームと検査は hook useLayoutFieldsForm、この部品は描くだけ)。宣言の順 = 画面の順。
// - activeChannel を渡すと、その送信チャンネルで使う欄だけ(共通 + その送信チャンネルだけ、D117)。共通の欄は「すべての送信方法で共通」の印。描かない欄の値はフォームに残る
// - 見出し・必須の印(fieldRequiredIn: 宣言の required か、requiredFor が channels に当たる時。件名はメールを送る時だけ、D211)・仮の文(宣言の placeholder)。送信チャンネルだけの欄は「<経路>だけ」の印、channels(送信チャンネル)に無い送信チャンネルだけの欄は「使われない」の印で薄く
// - 欄の型ごとの入力は LayoutFieldInput(ブロックの並びは LayoutBlocksInput)。readOnly = 読むだけ(システムのテンプレート・固定の文)
// - 欄に入ると onFocusField("<欄>[.<部分>]")(プレビューがその場所を示す)

"use client";

import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";

import { SoftBadge } from "@/components/Badge/SoftBadge";
import { Label } from "@/components/Input/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks/Span";
import { cn } from "@/lib/cn";
import { fieldBelongsTo, fieldRequiredIn, type MessageLayoutFields } from "@/lib/messaging";

import { messageChannelLabel } from "@/domains/core/messaging/constants/channelLabels";

import { LayoutFieldInput } from "./LayoutFieldInput";

/** 欄の中の誤りの最初の文(ボタンの label / url、組・並びの中)。無ければ null */
function firstNestedMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  for (const [key, inner] of Object.entries(error as Record<string, unknown>)) {
    if (key === "ref" || key === "type" || key === "types") continue;
    if (key === "message") {
      if (typeof inner === "string" && inner) return inner;
      continue;
    }
    const found = firstNestedMessage(inner);
    if (found) return found;
  }
  return null;
}

export { LayoutFieldInput, type LayoutFieldInputProps } from "./LayoutFieldInput";
export {
  ButtonLinkInput,
  KeyValueRowsInput,
  LAYOUT_IMAGE_PURPOSE,
  LineListInput,
  RowControls,
  type ButtonLinkInputProps,
  type LineListInputProps,
} from "./LayoutFieldControls";
export { LayoutBlocksInput, type LayoutBlocksInputProps } from "./LayoutBlocksInput";
export { allowedBlockKinds, emptyBlockOf, emptyValueOf, moveItem, removeItem, replaceItem } from "./fieldValues";

export type LayoutFieldsProps<T extends FieldValues> = {
  control: Control<T>;
  /** 欄の中身の置き場所(フォームの値の中の道。無い = 根に欄の鍵を並べる) */
  name?: string;
  /** レイアウトの欄の宣言 */
  fields: MessageLayoutFields;
  /** 送信チャンネルの鍵(渡すと、どれにも使われない送信チャンネルだけの欄に「使われない」の印) */
  channels?: readonly string[];
  /**
   * 今の送信チャンネル(プレビューのタブ、D117)。渡すと、その送信チャンネルで使う欄(全送信チャンネルで共通 + その送信チャンネルだけ)だけを描き、共通の欄に「すべての送信方法で共通」の印。
   * 描かない欄の値はフォームに残る(タブを替えても消えない)
   */
  activeChannel?: string | null;
  /** 読むだけ */
  readOnly?: boolean;
  onFocusField?: (path: string) => void;
};

export function LayoutFields<T extends FieldValues>({ control, name, fields, channels, activeChannel, readOnly, onFocusField }: LayoutFieldsProps<T>) {
  const entries = Object.entries(fields).filter(([, spec]) => !activeChannel || fieldBelongsTo(spec, activeChannel));
  if (entries.length === 0) {
    return (
      <Span size="sm" tone="muted">
        入力する欄はありません
      </Span>
    );
  }
  return (
    <Stack gap="md" data-slot="layout-fields">
      {entries.map(([key, spec]) => {
        const fieldPath = (name ? `${name}.${key}` : key) as Path<T>;
        const id = `layout-field-${(name ? `${name}-${key}` : key).replace(/[^a-zA-Z0-9]/g, "-")}`;
        const unused = Boolean(spec.channels && channels && !channels.some((channel) => fieldBelongsTo(spec, channel)));
        return (
          <Controller
            key={key}
            control={control}
            name={fieldPath}
            render={({ field, fieldState }) => (
              <Stack gap="2xs" className={cn(unused && "opacity-60")} data-slot="layout-field">
                <Flex align="center" gap="xs" wrap="wrap">
                  <Label htmlFor={id} className="text-sm font-medium">
                    {spec.label}
                    {fieldRequiredIn(spec, channels) ? (
                      <Span tone="destructive" data-slot="layout-field-required-mark">
                        {" *"}
                      </Span>
                    ) : null}
                  </Label>
                  {activeChannel && !spec.channels?.length ? (
                    <SoftBadge variant="outline" size="sm" data-slot="layout-field-common-mark">
                      すべての送信方法で共通
                    </SoftBadge>
                  ) : null}
                  {spec.channels?.length ? (
                    <SoftBadge variant="secondary" size="sm" data-slot="layout-field-channel-mark">
                      {spec.channels.map(messageChannelLabel).join("・")}だけ
                    </SoftBadge>
                  ) : null}
                  {unused ? (
                    <SoftBadge variant="muted" size="sm">
                      選んだ送信方法では使われない
                    </SoftBadge>
                  ) : null}
                </Flex>
                <LayoutFieldInput
                  id={id}
                  path={key}
                  shape={spec}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={spec.placeholder}
                  readOnly={readOnly}
                  onFocusField={onFocusField}
                />
                {fieldState.error ? (
                  <Span size="xs" tone="destructive">
                    {/* 並び・組・ボタンの中の誤りは欄の上に message が無い → 中の最初の文(ボタンの文言 / URL)、無ければまとめた文 */}
                    {fieldState.error.message || firstNestedMessage(fieldState.error) || "中の入力を確かめてください"}
                  </Span>
                ) : null}
              </Stack>
            )}
          />
        );
      })}
    </Stack>
  );
}
