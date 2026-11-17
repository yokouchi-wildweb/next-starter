// src/features/core/messaging/components/common/LayoutFields/LayoutBlocksInput.tsx
// 部品(props だけ): ブロックの並び(D123)の入力。許す種類(allow)から選んで足す・中身を直す・消す・上下に動かす。
// 見た目: 1 ブロック = 枠つきのカード(上の帯 = 番号・種類の印と名前・ブロックの操作・たたむ。たたむと帯に 1 行の要約)。
// 中の行(ラベルと値・箇条書き)の操作は小さく薄い × と矢印で、ブロックの操作と分ける。
// min / max: max に届くと足せず、min を割る削除はできない。種類ごとの中身:
// heading・paragraph = 文 / button = 文言と URL / image = 画像(notification.image)と代わりの文 / divider = 中身なし /
// keyValueTable = ラベルと値の行 / bulletList = 箇条書きの行

"use client";

import { useState } from "react";
import { ChevronDown, Heading, ImageIcon, List, Minus, MousePointerClick, Pilcrow, Plus, Rows3, type LucideIcon } from "lucide-react";

import { Button } from "@/components/Form/Button";
import { Input, Textarea } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { ManualMediaUploader } from "@/components/Form/MediaHandler";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks/Span";
import { MESSAGE_BLOCK_KIND_LABELS, type MessageBlockKind, type MessageBlocksConstraint } from "@/lib/messaging";

import { ButtonLinkInput, KeyValueRowsInput, LAYOUT_IMAGE_PURPOSE, LineListInput, RowControls } from "./LayoutFieldControls";
import { allowedBlockKinds, asRecord, asText, emptyBlockOf, moveItem, oneLine, removeItem, replaceItem } from "./fieldValues";

export type LayoutBlocksInputProps = {
  id: string;
  path: string;
  constraint: MessageBlocksConstraint;
  value: readonly unknown[];
  onChange: (value: unknown) => void;
  readOnly?: boolean;
  onFocusField?: (path: string) => void;
};

/** 種類の印(見出しの帯で種類をひと目で分ける) */
const BLOCK_ICONS: Partial<Record<MessageBlockKind, LucideIcon>> = {
  heading: Heading,
  paragraph: Pilcrow,
  button: MousePointerClick,
  image: ImageIcon,
  divider: Minus,
  keyValueTable: Rows3,
  bulletList: List,
};

/** たたんだ時に見出しの横へ出す 1 行の要約 */
function blockSummary(block: Record<string, unknown>): string {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return asText(block.text).split("\n")[0] ?? "";
    case "button":
      return asText(block.label);
    case "image":
      return asText(block.alt) || (asText(block.src) ? "画像あり" : "");
    case "keyValueTable": {
      const rows = Array.isArray(block.rows) ? block.rows.length : 0;
      return rows > 0 ? `${rows} 行` : "";
    }
    case "bulletList": {
      const items = Array.isArray(block.items) ? block.items.length : 0;
      return items > 0 ? `${items} 項目` : "";
    }
    default:
      return "";
  }
}

export function LayoutBlocksInput({ id, path, constraint, value, onChange, readOnly, onFocusField }: LayoutBlocksInputProps) {
  const kinds = allowedBlockKinds(constraint);
  const blocks = value.map(asRecord);
  const canAdd = !readOnly && kinds.length > 0 && (constraint.max === undefined || blocks.length < constraint.max);
  const canRemove = !readOnly && blocks.length > (constraint.min ?? 0);
  // たたんだブロック(並びの位置ごと。動かす・消す・足すと一緒に動かす。画面の中だけの状態)。
  // 開いた時にあるブロックは全部たたんだ状態で始める(後から足したブロックは開いて出る)
  const [collapsed, setCollapsed] = useState<boolean[]>(() => value.map(() => true));
  const isCollapsed = (index: number) => collapsed[index] === true;
  const toggle = (index: number) => setCollapsed((prev) => replaceItem(padTo(prev, blocks.length), index, !prev[index]));
  const move = (index: number, direction: -1 | 1) => {
    onChange(moveItem(blocks, index, direction));
    setCollapsed((prev) => moveItem(padTo(prev, blocks.length), index, direction));
  };
  const addBlock = (kind: MessageBlockKind) => {
    onChange([...blocks, emptyBlockOf(kind)]);
    setCollapsed((prev) => [...padTo(prev, blocks.length), false]);
  };
  const remove = (index: number) => {
    onChange(removeItem(blocks, index));
    setCollapsed((prev) => removeItem(padTo(prev, blocks.length), index));
  };

  return (
    <Stack gap="sm" data-slot="layout-field-blocks">
      {blocks.map((block, index) => {
        const kind = asText(block.type) as MessageBlockKind;
        const Icon = BLOCK_ICONS[kind];
        const closed = isCollapsed(index);
        const summary = closed ? blockSummary(block) : "";
        // 1 ブロック = 枠つきのカード: 上の帯(番号・種類・ブロックの操作・たたむ)+ 中身。中の行の操作は小さく薄く(RowControls tone item)
        return (
          <Stack key={index} gap="none" className="overflow-hidden rounded-lg border border-border bg-card shadow-xs" data-slot="layout-field-block">
            <Flex
              align="center"
              justify="between"
              gap="xs"
              className={`bg-muted/50 py-1 pl-3 pr-1 ${closed ? "" : "border-b border-border"}`}
              data-slot="layout-field-block-header"
            >
              <Flex align="center" gap="md" className="min-w-0">
                <Span size="xs" weight="semiBold" tone="muted" className="min-w-6 rounded-md border border-border bg-background px-1.5 py-0.5 text-center tabular-nums">
                  {String(index + 1)}
                </Span>
                {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
                <Span size="sm" weight="semiBold" className="shrink-0">
                  {MESSAGE_BLOCK_KIND_LABELS[kind] ?? kind}
                </Span>
                {summary ? (
                  <Span size="sm" tone="muted" className="min-w-0 truncate">
                    {summary}
                  </Span>
                ) : null}
              </Flex>
              <Flex align="center" gap="none" className="shrink-0">
                {readOnly ? null : (
                  <RowControls index={index} count={blocks.length} canRemove={canRemove} onMove={(direction) => move(index, direction)} onRemove={() => remove(index)} />
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground"
                  aria-expanded={!closed}
                  aria-label={closed ? "開く" : "たたむ"}
                  title={closed ? "開く" : "たたむ"}
                  onClick={() => toggle(index)}
                >
                  <ChevronDown className={`size-4 transition-transform ${closed ? "" : "rotate-180"}`} />
                </Button>
              </Flex>
            </Flex>
            {closed ? null : (
              <Stack gap="xs" className="p-3" data-slot="layout-field-block-body">
                <BlockBody
                  id={`${id}-${index}`}
                  path={`${path}.${index}`}
                  block={block}
                  onChange={(next) => onChange(replaceItem(blocks, index, next))}
                  readOnly={readOnly}
                  onFocusField={onFocusField}
                />
              </Stack>
            )}
          </Stack>
        );
      })}
      {blocks.length === 0 ? (
        <Span size="sm" tone="muted">
          ブロックはありません
        </Span>
      ) : null}
      {readOnly ? null : (
        // 足す所 = 点線の枠の 1 行: 「＋ 追加」の見出しの横に、種類ごとの札(印 + 名前)を並べ、押した種類をそのまま足す
        // (セレクトで選んでから押す 2 手を 1 手に。種類が多ければ折り返す)。数の決まりは右端に
        <Flex
          align="center"
          gap="md"
          wrap="wrap"
          className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2"
          data-slot="layout-field-blocks-add"
        >
          <Flex align="center" gap="xs" className="shrink-0">
            <Plus className="size-4 text-muted-foreground" aria-hidden />
            <Span size="sm" weight="medium" tone="muted">
              ブロックを追加
            </Span>
          </Flex>
          <Flex align="center" gap="xs" wrap="wrap" className="min-w-0 flex-1" role="group" aria-label="追加するブロックの種類">
            {kinds.map((option) => {
              const Icon = BLOCK_ICONS[option.value];
              return (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 rounded-full px-3 font-normal"
                  disabled={!canAdd}
                  onClick={() => addBlock(option.value)}
                  data-slot="layout-field-blocks-add-kind"
                >
                  {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
                  {option.label}
                </Button>
              );
            })}
          </Flex>
          {constraint.max !== undefined || constraint.min !== undefined ? (
            <Span size="xs" tone="muted" className="shrink-0 tabular-nums">
              {blocks.length} 個{constraint.min !== undefined ? ` / ${constraint.min} 個以上` : ""}
              {constraint.max !== undefined ? ` / ${constraint.max} 個まで` : ""}
            </Span>
          ) : null}
        </Flex>
      )}
    </Stack>
  );
}

/** 並びの長さに足りない所を false で埋める(たたんだ状態の配列を並びに合わせる) */
function padTo(values: readonly boolean[], length: number): boolean[] {
  return Array.from({ length }, (_, index) => values[index] === true);
}

type BlockBodyProps = {
  id: string;
  path: string;
  block: Record<string, unknown>;
  onChange: (block: Record<string, unknown>) => void;
  readOnly?: boolean;
  onFocusField?: (path: string) => void;
};

/** ブロック 1 つの中身(種類ごと) */
function BlockBody({ id, path, block, onChange, readOnly, onFocusField }: BlockBodyProps) {
  const set = (key: string, next: unknown) => onChange({ ...block, [key]: next });
  const focus = (part: string) => () => onFocusField?.(`${path}.${part}`);
  switch (block.type) {
    case "heading":
      return (
        <Input
          id={id}
          aria-label="小見出し"
          value={asText(block.text)}
          readOnly={readOnly}
          onFocus={focus("text")}
          onChange={(e) => set("text", oneLine(e.target.value))}
        />
      );
    case "paragraph":
      return (
        <Textarea
          id={id}
          aria-label="段落"
          rows={4}
          value={asText(block.text)}
          readOnly={readOnly}
          onFocus={focus("text")}
          onChange={(e) => set("text", e.target.value)}
        />
      );
    case "button":
      return (
        <ButtonLinkInput
          id={id}
          path={path}
          kind="button"
          value={{ label: block.label, url: block.url }}
          onChange={(next) => onChange({ ...block, ...next })}
          readOnly={readOnly}
          onFocusField={onFocusField}
        />
      );
    case "image":
      return (
        <Stack gap="xs">
          {readOnly ? (
            <Span size="sm" tone="muted" className="break-all">
              {asText(block.src) || "画像なし"}
            </Span>
          ) : (
            <ManualMediaUploader
              purpose={LAYOUT_IMAGE_PURPOSE}
              value={asText(block.src) || null}
              onValueChange={(url) => {
                onFocusField?.(`${path}.src`);
                set("src", url ?? "");
              }}
            />
          )}
          <Stack gap="2xs">
            <Label htmlFor={`${id}-alt`} className="text-xs">
              代わりの文(任意)
            </Label>
            <Input
              id={`${id}-alt`}
              value={asText(block.alt)}
              readOnly={readOnly}
              onFocus={focus("alt")}
              onChange={(e) => {
                const alt = oneLine(e.target.value);
                if (alt) set("alt", alt);
                else onChange(Object.fromEntries(Object.entries(block).filter(([key]) => key !== "alt")));
              }}
            />
          </Stack>
        </Stack>
      );
    case "divider":
      return (
        <Span size="xs" tone="muted">
          区切りの線を入れます
        </Span>
      );
    case "keyValueTable":
      return (
        <KeyValueRowsInput
          id={id}
          path={`${path}.rows`}
          value={block.rows}
          onChange={(rows) => set("rows", rows)}
          readOnly={readOnly}
          onFocusField={onFocusField}
        />
      );
    case "bulletList":
      return (
        <LineListInput
          id={id}
          path={`${path}.items`}
          min={1}
          value={block.items}
          onChange={(items) => set("items", items)}
          readOnly={readOnly}
          onFocusField={onFocusField}
        />
      );
    default:
      return (
        <Span size="sm" tone="destructive">
          知らない種類のブロックです({asText(block.type)})
        </Span>
      );
  }
}
