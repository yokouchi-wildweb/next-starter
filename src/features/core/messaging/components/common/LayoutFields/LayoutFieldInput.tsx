// src/features/core/messaging/components/common/LayoutFields/LayoutFieldInput.tsx
// 部品(props だけ): ひな形の欄 1 つの入力(値と onChange で動く。見出しは呼び手)。欄の型(D123)ごと:
// line = 1 行(改行は空白)/ paragraph・longText = 複数行 / number / date(YYYY-MM-DD)/ select / image = 用途 notification.image のアップロード /
// button {label, url} / link {label?, url} / keyValue = 項目と値の行 / list = 1 つの型の並び / group = 名前つきの欄 / blocks = ブロックの並び。
// 並び・組は宣言のとおり入れ子に描く(深さの上限は宣言が決める)。readOnly = 値を読むだけ(システムのテンプレート・固定の文)

"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/Form/Button";
import { DateInput, Input, NumberInput, SelectInput, Textarea } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { ManualMediaUploader } from "@/components/Form/MediaHandler";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import type { MessageFieldShape } from "@/lib/messaging";

import { LayoutBlocksInput } from "./LayoutBlocksInput";
import { asArray, asRecord, asText, emptyValueOf, moveItem, oneLine, removeItem, replaceItem } from "./fieldValues";

/** 画像の用途(storage の purpose。お知らせ・テンプレート・文言の編集の画像は同じ) */
export const LAYOUT_IMAGE_PURPOSE = "notification.image";

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
    case "link": {
      const record = asRecord(value);
      const set = (key: string, next: string) => onChange({ ...record, [key]: next });
      return (
        <Stack space={2} className="rounded-md border border-border p-3" data-slot="layout-field-button">
          <Stack space={1}>
            <Label htmlFor={`${id}-label`} className="text-xs">
              {shape.type === "button" ? "ボタンの文言" : "リンクの文言(任意)"}
            </Label>
            <Input
              id={`${id}-label`}
              value={asText(record.label)}
              placeholder={placeholder}
              readOnly={readOnly}
              onFocus={() => onFocusField?.(`${path}.label`)}
              onChange={(e) => set("label", oneLine(e.target.value))}
            />
          </Stack>
          <Stack space={1}>
            <Label htmlFor={`${id}-url`} className="text-xs">
              URL
            </Label>
            <Input
              id={`${id}-url`}
              type="url"
              value={asText(record.url)}
              placeholder="https://"
              readOnly={readOnly}
              onFocus={() => onFocusField?.(`${path}.url`)}
              onChange={(e) => set("url", oneLine(e.target.value).trim())}
            />
          </Stack>
        </Stack>
      );
    }
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
        <Stack space={2} data-slot="layout-field-list">
          {items.map((item, index) => (
            <Flex key={index} align="start" gap="xs">
              <Stack space={1} className="min-w-0 flex-1">
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
            <Flex align="center" gap="sm">
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
        <Stack space={3} className="rounded-md border border-border p-3" data-slot="layout-field-group">
          {Object.entries(shape.fields).map(([key, field]) => (
            <Stack key={key} space={1}>
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

type RowControlsProps = {
  index: number;
  count: number;
  canRemove: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
};

/** 並びの 1 行の操作(上へ・下へ・削除) */
export function RowControls({ index, count, canRemove, onMove, onRemove }: RowControlsProps) {
  return (
    <Flex align="center" gap="xs" className="shrink-0">
      <Button type="button" size="icon" variant="ghost" aria-label="上へ" disabled={index === 0} onClick={() => onMove(-1)}>
        <ArrowUp className="size-4" />
      </Button>
      <Button type="button" size="icon" variant="ghost" aria-label="下へ" disabled={index === count - 1} onClick={() => onMove(1)}>
        <ArrowDown className="size-4" />
      </Button>
      <Button type="button" size="icon" variant="ghost" aria-label="削除" disabled={!canRemove} onClick={onRemove}>
        <Trash2 className="size-4" />
      </Button>
    </Flex>
  );
}

type KeyValueRowsInputProps = {
  id: string;
  path: string;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly?: boolean;
  onFocusField?: (path: string) => void;
};

/** 項目と値の行([{key, value}])。足す・消す・並べ替え */
export function KeyValueRowsInput({ id, path, value, onChange, readOnly, onFocusField }: KeyValueRowsInputProps) {
  const rows = asArray(value).map(asRecord);
  const set = (index: number, key: "key" | "value", next: string) => onChange(replaceItem(rows, index, { ...rows[index], [key]: next }));
  return (
    <Stack space={2} data-slot="layout-field-key-value">
      {rows.map((row, index) => (
        <Flex key={index} align="center" gap="xs">
          <Input
            id={index === 0 ? id : `${id}-${index}`}
            aria-label="項目"
            placeholder="項目"
            className="w-2/5"
            value={asText(row.key)}
            readOnly={readOnly}
            onFocus={() => onFocusField?.(`${path}.${index}.key`)}
            onChange={(e) => set(index, "key", oneLine(e.target.value))}
          />
          <Input
            aria-label="値"
            placeholder="値"
            className="flex-1"
            value={asText(row.value)}
            readOnly={readOnly}
            onFocus={() => onFocusField?.(`${path}.${index}.value`)}
            onChange={(e) => set(index, "value", oneLine(e.target.value))}
          />
          {readOnly ? null : (
            <RowControls
              index={index}
              count={rows.length}
              canRemove
              onMove={(direction) => onChange(moveItem(rows, index, direction))}
              onRemove={() => onChange(removeItem(rows, index))}
            />
          )}
        </Flex>
      ))}
      {rows.length === 0 && readOnly ? (
        <Span size="sm" tone="muted">
          なし
        </Span>
      ) : null}
      {readOnly ? null : (
        <Flex>
          <Button type="button" size="sm" variant="outline" onClick={() => onChange([...rows, { key: "", value: "" }])}>
            <Plus className="size-4" />
            行を追加
          </Button>
        </Flex>
      )}
    </Stack>
  );
}
