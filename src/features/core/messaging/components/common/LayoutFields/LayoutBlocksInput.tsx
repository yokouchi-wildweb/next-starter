// src/features/core/messaging/components/common/LayoutFields/LayoutBlocksInput.tsx
// 部品(props だけ): ブロックの並び(D123)の入力。許す種類(allow)から選んで足す・中身を直す・消す・上下に動かす。
// min / max: max に届くと足せず、min を割る削除はできない。種類ごとの中身:
// heading・paragraph = 文 / button = 文言と URL / image = 画像(notification.image)と代わりの文 / divider = 中身なし /
// keyValueTable = 項目と値の行 / bulletList = 箇条書きの行

"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/Form/Button";
import { Input, SelectInput, Textarea } from "@/components/Form/Input/Manual";
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

export function LayoutBlocksInput({ id, path, constraint, value, onChange, readOnly, onFocusField }: LayoutBlocksInputProps) {
  const kinds = allowedBlockKinds(constraint);
  // 足すブロックの種類の選択(画面の中だけの状態)
  const [nextKind, setNextKind] = useState<MessageBlockKind | "">(kinds[0]?.value ?? "");
  const blocks = value.map(asRecord);
  const canAdd = !readOnly && kinds.length > 0 && (constraint.max === undefined || blocks.length < constraint.max);
  const canRemove = !readOnly && blocks.length > (constraint.min ?? 0);

  return (
    <Stack space={2} data-slot="layout-field-blocks">
      {blocks.map((block, index) => {
        const kind = asText(block.type) as MessageBlockKind;
        return (
          <Stack key={index} space={2} className="rounded-md border border-border bg-card p-3" data-slot="layout-field-block">
            <Flex align="center" justify="between" gap="xs">
              <Span size="sm" weight="semiBold">
                {MESSAGE_BLOCK_KIND_LABELS[kind] ?? kind}
              </Span>
              {readOnly ? null : (
                <RowControls
                  index={index}
                  count={blocks.length}
                  canRemove={canRemove}
                  onMove={(direction) => onChange(moveItem(blocks, index, direction))}
                  onRemove={() => onChange(removeItem(blocks, index))}
                />
              )}
            </Flex>
            <BlockBody
              id={`${id}-${index}`}
              path={`${path}.${index}`}
              block={block}
              onChange={(next) => onChange(replaceItem(blocks, index, next))}
              readOnly={readOnly}
              onFocusField={onFocusField}
            />
          </Stack>
        );
      })}
      {blocks.length === 0 ? (
        <Span size="sm" tone="muted">
          ブロックはありません
        </Span>
      ) : null}
      {readOnly ? null : (
        <Flex align="center" gap="xs" wrap="wrap">
          {kinds.length > 1 ? (
            <SelectInput
              id={`${id}-kind`}
              aria-label="足すブロックの種類"
              value={nextKind}
              options={kinds}
              showPlaceholderOption={false}
              onChange={(next) => setNextKind((next ? String(next) : "") as MessageBlockKind | "")}
            />
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canAdd || !nextKind}
            onClick={() => nextKind && onChange([...blocks, emptyBlockOf(nextKind)])}
          >
            <Plus className="size-4" />
            {kinds.length === 1 ? `${kinds[0].label}を追加` : "ブロックを追加"}
          </Button>
          {constraint.max !== undefined || constraint.min !== undefined ? (
            <Span size="xs" tone="muted">
              {blocks.length} 個{constraint.min !== undefined ? ` / ${constraint.min} 個以上` : ""}
              {constraint.max !== undefined ? ` / ${constraint.max} 個まで` : ""}
            </Span>
          ) : null}
        </Flex>
      )}
    </Stack>
  );
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
        <Stack space={2}>
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
          <Stack space={1}>
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
