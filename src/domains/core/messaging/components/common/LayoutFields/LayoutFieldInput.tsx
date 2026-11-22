// src/domains/core/messaging/components/common/LayoutFields/LayoutFieldInput.tsx
// 部品(props だけ): レイアウトの欄 1 つの入力(値と onChange で動く。見出しは呼び手)。欄の型(D123)ごと:
// line = 1 行(改行は空白)/ paragraph・longText = 複数行 / number / date(YYYY-MM-DD)/ select / image = 用途 notification.image のアップロード /
// button {label, url} / link {label?, url} / keyValue = ラベルと値の行 / list = 1 つの型の並び / group = 名前つきの欄 / blocks = ブロックの並び。
// 並び・組は宣言のとおり入れ子に描く(深さの上限は宣言が決める)。readOnly = 値を読むだけ(システムのテンプレート・固定の文)

"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/Button/Button";
import { DateInput } from "@/components/Input/DateInput";
import { Input } from "@/components/Input/Input";
import { NumberInput } from "@/components/Input/NumberInput";
import { SelectInput } from "@/components/Input/Select";
import { Textarea } from "@/components/Input/Textarea";
import { Label } from "@/components/Input/Label";
import { ManualMediaUploader } from "@/lib/mediaInputSuite";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import type { MessageFieldShape } from "@/lib/messaging";

import { LayoutBlocksInput } from "./LayoutBlocksInput";
import { ButtonLinkInput, KeyValueRowsInput, LAYOUT_IMAGE_PURPOSE, RowControls } from "./LayoutFieldControls";
import { asArray, asRecord, asText, emptyValueOf, moveItem, oneLine, removeItem, replaceItem } from "./fieldValues";

export type LayoutFieldInputProps = {
  /** 欄の id(label の htmlFor。入れ子は後ろに -<鍵> / -<番号>) */
  id: string;
  /** 欄の場所("<欄>[.<部分>|.<番号>]"。onFocusField に渡す) */
  path: string;
  shape: MessageFieldShape;
  value: unknown;
  onChange: (value: unknown) => void;
  placeholder?: string;
  readOnly?: boolean;
  /** 欄に入った時(プレビューがその場所を示す) */
  onFocusField?: (path: string) => void;
};

export function LayoutFieldInput({ id, path, shape, value, onChange, placeholder, readOnly, onFocusField }: LayoutFieldInputProps) {
  const focus = () => onFocusField?.(path);
  switch (shape.type) {
    case "line":
      return (
        <Input id={id} value={asText(value)} placeholder={placeholder} readOnly={readOnly} onFocus={focus} onChange={(e) => onChange(oneLine(e.target.value))} />
      );
    case "paragraph":
    case "longText":
      return (
        <Textarea
          id={id}
          value={asText(value)}
          rows={shape.type === "longText" ? 8 : 4}
          placeholder={placeholder}
          readOnly={readOnly}
          onFocus={focus}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
      return (
        <NumberInput
          id={id}
          nullable
          value={typeof value === "number" ? value : null}
          placeholder={placeholder}
          readOnly={readOnly}
          onFocus={focus}
          onChange={(next) => onChange(next ?? undefined)}
        />
      );
    case "date":
      return <DateInput id={id} value={asText(value)} placeholder={placeholder} readOnly={readOnly} onFocus={focus} onValueChange={(next) => onChange(next)} />;
    case "select":
      return (
        <SelectInput
          id={id}
          value={asText(value)}
          options={shape.options.map((option) => ({ value: option.value, label: option.label }))}
          placeholder={placeholder}
          disabled={readOnly}
          onChange={(next) => {
            focus();
            onChange(next ? String(next) : "");
          }}
        />
      );
    case "image":
      return readOnly ? (
        <Para size="sm" tone="muted" className="my-0 break-all">
          {asText(value) || "画像なし"}
        </Para>
      ) : (
        <ManualMediaUploader
          purpose={LAYOUT_IMAGE_PURPOSE}
          value={asText(value) || null}
          onValueChange={(url) => {
            focus();
            onChange(url ?? "");
          }}
        />
      );
    case "button":
    case "link":
      return (
        <ButtonLinkInput
          id={id}
          path={path}
          kind={shape.type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          readOnly={readOnly}
          onFocusField={onFocusField}
        />
      );
    case "keyValue":
      return <KeyValueRowsInput id={id} path={path} value={value} onChange={onChange} readOnly={readOnly} onFocusField={onFocusField} />;
    case "blocks":
      return (
        <LayoutBlocksInput
          id={id}
          path={path}
          constraint={shape}
          value={asArray(value)}
          onChange={onChange}
          readOnly={readOnly}
          onFocusField={onFocusField}
        />
      );
    case "list": {
      const items = asArray(value);
      const canAdd = !readOnly && (shape.max === undefined || items.length < shape.max);
      const canRemove = !readOnly && items.length > (shape.min ?? 0);
      return (
        <Stack gap="xs" data-slot="layout-field-list">
          {items.map((item, index) => (
            <Flex key={index} align="start" gap="xs">
              <Stack gap="2xs" className="min-w-0 flex-1">
                <LayoutFieldInput
                  id={index === 0 ? id : `${id}-${index}`}
                  path={`${path}.${index}`}
                  shape={shape.of}
                  value={item}
                  onChange={(next) => onChange(replaceItem(items, index, next))}
                  placeholder={placeholder}
                  readOnly={readOnly}
                  onFocusField={onFocusField}
                />
              </Stack>
              {readOnly ? null : (
                <RowControls
                  index={index}
                  count={items.length}
                  canRemove={canRemove}
                  onMove={(direction) => onChange(moveItem(items, index, direction))}
                  onRemove={() => onChange(removeItem(items, index))}
                />
              )}
            </Flex>
          ))}
          {items.length === 0 && readOnly ? (
            <Span size="sm" tone="muted">
              なし
            </Span>
          ) : null}
          {readOnly ? null : (
            <Flex align="center" gap="md">
              <Button type="button" size="sm" variant="outline" disabled={!canAdd} onClick={() => onChange([...items, emptyValueOf(shape.of)])}>
                <Plus className="size-4" />
                追加
              </Button>
              {shape.max !== undefined ? (
                <Span size="xs" tone="muted">
                  {items.length} / {shape.max}
                </Span>
              ) : null}
            </Flex>
          )}
        </Stack>
      );
    }
    case "group": {
      const record = asRecord(value);
      return (
        <Stack gap="sm" className="rounded-md border border-border p-3" data-slot="layout-field-group">
          {Object.entries(shape.fields).map(([key, field]) => (
            <Stack key={key} gap="2xs">
              <Label htmlFor={`${id}-${key}`} className="text-xs">
                {field.label ?? key}
                {field.required ? <Span tone="destructive"> *</Span> : null}
              </Label>
              <LayoutFieldInput
                id={`${id}-${key}`}
                path={`${path}.${key}`}
                shape={field}
                value={record[key]}
                onChange={(next) => onChange({ ...record, [key]: next })}
                readOnly={readOnly}
                onFocusField={onFocusField}
              />
            </Stack>
          ))}
        </Stack>
      );
    }
  }
}
