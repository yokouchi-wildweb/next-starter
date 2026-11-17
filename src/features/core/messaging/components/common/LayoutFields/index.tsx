// src/features/core/messaging/components/common/LayoutFields/index.tsx
// 部品(props だけ): ひな形の欄の宣言(D123)から入力を並べる。react-hook-form の control と欄の場所(name)に結ぶ
// (フォームと検査は hook useLayoutFieldsForm、この部品は描くだけ)。宣言の順 = 画面の順。
// - 見出し・必須の印・仮の文(宣言の placeholder)。経路だけの欄は「<経路>だけ」の印、channels(送る経路)に無い経路だけの欄は「使われない」の印で薄く
// - 欄の型ごとの入力は LayoutFieldInput(ブロックの並びは LayoutBlocksInput)。readOnly = 読むだけ(システムのテンプレート・固定の文)
// - 欄に入ると onFocusField("<欄>[.<部分>]")(プレビューがその場所を示す)

"use client";

import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";

import { SoftBadge } from "@/components/Badge";
import { Label } from "@/components/Form/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks/Span";
import { cn } from "@/lib/cn";
import { fieldBelongsTo, type MessageLayoutFields } from "@/lib/messaging";

import { messageChannelLabel } from "@/features/core/messaging/constants/channelLabels";

import { LayoutFieldInput } from "./LayoutFieldInput";

export { LayoutFieldInput, KeyValueRowsInput, RowControls, LAYOUT_IMAGE_PURPOSE, type LayoutFieldInputProps } from "./LayoutFieldInput";
export { LayoutBlocksInput, type LayoutBlocksInputProps } from "./LayoutBlocksInput";
export { allowedBlockKinds, emptyBlockOf, emptyValueOf, moveItem, removeItem, replaceItem } from "./fieldValues";

export type LayoutFieldsProps<T extends FieldValues> = {
  control: Control<T>;
  /** 欄の中身の置き場所(フォームの値の中の道。無い = 根に欄の鍵を並べる) */
  name?: string;
  /** ひな形の欄の宣言 */
  fields: MessageLayoutFields;
  /** 送る経路の鍵(渡すと、どれにも使われない経路だけの欄に「使われない」の印) */
  channels?: readonly string[];
  /** 読むだけ */
  readOnly?: boolean;
  onFocusField?: (path: string) => void;
};

export function LayoutFields<T extends FieldValues>({ control, name, fields, channels, readOnly, onFocusField }: LayoutFieldsProps<T>) {
  const entries = Object.entries(fields);
  if (entries.length === 0) {
    return (
      <Span size="sm" tone="muted">
        入力する欄はありません
      </Span>
    );
  }
  return (
    <Stack space={4} data-slot="layout-fields">
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
              <Stack space={1} className={cn(unused && "opacity-60")} data-slot="layout-field">
                <Flex align="center" gap="xs" wrap="wrap">
                  <Label htmlFor={id} className="text-sm font-medium">
                    {spec.label}
                    {spec.required ? <Span tone="destructive"> *</Span> : null}
                  </Label>
                  {spec.channels?.length ? (
                    <SoftBadge variant="secondary" size="sm" data-slot="layout-field-channel-mark">
                      {spec.channels.map(messageChannelLabel).join("・")}だけ
                    </SoftBadge>
                  ) : null}
                  {unused ? (
                    <SoftBadge variant="muted" size="sm">
                      送る経路では使われない
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
                    {/* 並び・組・ブロックの中の誤りは欄の上に message が無い → まとめた文 */}
                    {fieldState.error.message || "中の入力を確かめてください"}
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
