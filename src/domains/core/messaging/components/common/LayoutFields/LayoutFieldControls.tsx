// src/domains/core/messaging/components/common/LayoutFields/LayoutFieldControls.tsx
// 部品(props だけ): 欄の入力とブロックの並びが共に使う小さな入力(並びの行の操作・ボタン / リンク・ラベルと値の行・1行テキストの並び)。
// LayoutFieldInput と LayoutBlocksInput の両方がここを読む(2 つの間で値の import の輪を作らない)

"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { Label } from "@/components/Input/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks/Span";

import { asArray, asRecord, asText, moveItem, oneLine, removeItem, replaceItem } from "./fieldValues";

/** 画像の用途(storage の purpose。お知らせ・テンプレート・テキストの編集の画像は同じ) */
export const LAYOUT_IMAGE_PURPOSE = "notification.image";

export type ButtonLinkInputProps = {
  id: string;
  path: string;
  /** button = 文言が必須 / link = 文言は任意 */
  kind: "button" | "link";
  value: unknown;
  onChange: (value: Record<string, unknown>) => void;
  placeholder?: string;
  readOnly?: boolean;
  onFocusField?: (path: string) => void;
};

/** ボタン {label, url} / リンク {label?, url} */
export function ButtonLinkInput({ id, path, kind, value, onChange, placeholder, readOnly, onFocusField }: ButtonLinkInputProps) {
  const record = asRecord(value);
  const set = (key: string, next: string) => onChange({ ...record, [key]: next });
  return (
    <Stack gap="xs" className="rounded-md border border-border p-3" data-slot="layout-field-button">
      <Stack gap="2xs">
        <Label htmlFor={`${id}-label`} className="text-xs">
          {kind === "button" ? "ボタンの文言" : "リンクの文言(任意)"}
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
      <Stack gap="2xs">
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

export type LineListInputProps = {
  id: string;
  path: string;
  value: unknown;
  onChange: (value: string[]) => void;
  /** これより少なくは消せない */
  min?: number;
  readOnly?: boolean;
  onFocusField?: (path: string) => void;
};

/** 1行テキストの並び(箇条書き)。足す・消す・上下 */
export function LineListInput({ id, path, value, onChange, min = 0, readOnly, onFocusField }: LineListInputProps) {
  const items = asArray(value).map(asText);
  return (
    <Stack gap="xs" data-slot="layout-field-line-list">
      {items.map((item, index) => (
        <Flex key={index} align="center" gap="xs">
          <Input
            id={index === 0 ? id : `${id}-${index}`}
            className="flex-1"
            value={item}
            readOnly={readOnly}
            onFocus={() => onFocusField?.(`${path}.${index}`)}
            onChange={(e) => onChange(replaceItem(items, index, oneLine(e.target.value)))}
          />
          {readOnly ? null : (
            <RowControls
              index={index}
              count={items.length}
              canRemove={items.length > min}
              onMove={(direction) => onChange(moveItem(items, index, direction))}
              onRemove={() => onChange(removeItem(items, index))}
              tone="item"
            />
          )}
        </Flex>
      ))}
      {readOnly ? null : (
        <Flex>
          <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" onClick={() => onChange([...items, ""])}>
            <Plus className="size-4" />
            追加
          </Button>
        </Flex>
      )}
    </Stack>
  );
}

type RowControlsProps = {
  index: number;
  count: number;
  canRemove: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  /**
   * block = ブロックや欄の並びの 1 つ(見出しの帯に置く、ふつうの大きさ、削除はごみ箱)/
   * item = ブロックの中の行(行の右に置く、小さく薄い、削除は ×)。外と中の操作を見た目で分ける @default "block"
   */
  tone?: "block" | "item";
};

/** 並びの 1 行の操作(上へ・下へ・削除) */
export function RowControls({ index, count, canRemove, onMove, onRemove, tone = "block" }: RowControlsProps) {
  const item = tone === "item";
  // 乗った時の色は ghost のまま(hover:bg-accent + text-accent-foreground)。ブロックの操作と同じ組で、地と矢印の色が合う
  const buttonClass = item ? "size-7 text-muted-foreground" : "size-8";
  const iconClass = item ? "size-3.5" : "size-4";
  return (
    <Flex align="center" gap="none" className="shrink-0" data-slot={item ? "row-controls-item" : "row-controls-block"}>
      <Button type="button" size="icon" variant="ghost" className={buttonClass} aria-label="上へ" disabled={index === 0} onClick={() => onMove(-1)}>
        <ArrowUp className={iconClass} />
      </Button>
      <Button type="button" size="icon" variant="ghost" className={buttonClass} aria-label="下へ" disabled={index === count - 1} onClick={() => onMove(1)}>
        <ArrowDown className={iconClass} />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={`${buttonClass} hover:bg-destructive/10 hover:text-destructive-text`}
        aria-label="削除"
        disabled={!canRemove}
        onClick={onRemove}
      >
        {item ? <X className={iconClass} /> : <Trash2 className={iconClass} />}
      </Button>
    </Flex>
  );
}

type KeyValueRowsInputProps = {
  id: string;
  path: string;
  value: unknown;
  onChange: (value: Record<string, unknown>[]) => void;
  readOnly?: boolean;
  onFocusField?: (path: string) => void;
};

/** ラベルと値の行([{key, value}])。足す・消す・並べ替え */
export function KeyValueRowsInput({ id, path, value, onChange, readOnly, onFocusField }: KeyValueRowsInputProps) {
  const rows = asArray(value).map(asRecord);
  const set = (index: number, key: "key" | "value", next: string) => onChange(replaceItem(rows, index, { ...rows[index], [key]: next }));
  return (
    <Stack gap="xs" data-slot="layout-field-key-value">
      {rows.map((row, index) => (
        <Flex key={index} align="center" gap="xs">
          <Input
            id={index === 0 ? id : `${id}-${index}`}
            aria-label="ラベル"
            placeholder="ラベル"
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
              tone="item"
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
          <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" onClick={() => onChange([...rows, { key: "", value: "" }])}>
            <Plus className="size-4" />
            行を追加
          </Button>
        </Flex>
      )}
    </Stack>
  );
}
