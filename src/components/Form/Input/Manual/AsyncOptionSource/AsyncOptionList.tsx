"use client";

// src/components/Form/Input/Manual/AsyncOptionSource/AsyncOptionList.tsx
//
// 非同期候補リスト（cmdk CommandList ベース）。
//  - multiple: チェックボックス付き行。クリック / チェックで onToggle
//  - single: チェックマーク付き行。クリックで onToggle（確定は消費者側）
//  - disabledValues: 選択不可の行（追加済み等）。表示は残し、label の後ろに disabledLabelSuffix を付ける
//  - renderOption: 行の表示を差し替える（name + かな の 2 行表示など）

import { type ReactNode, type UIEvent } from "react";
import { Check } from "lucide-react";

import { Checkbox } from "@/components/_shadcn/checkbox";
import { CommandItem, CommandList } from "@/components/_shadcn/command";
import {
  includesOptionValue,
  resolveOptionItemIdentity,
  type OptionPrimitive,
} from "@/components/Form/utils";
import { type Options } from "@/components/Form/types";
import { Span } from "@/components/TextBlocks/Span";
import { cn } from "@/lib/cn";

export type AsyncOptionListSelectionMode = "multiple" | "single";

export type AsyncOptionListProps = {
  options: Options[];
  selectedValues: OptionPrimitive[];
  onToggle: (value: OptionPrimitive) => void;
  /** multiple = チェックボックス行（既定） | single = チェックマーク行 */
  selectionMode?: AsyncOptionListSelectionMode;
  /** 選択不可にする値（行は表示する） */
  disabledValues?: OptionPrimitive[];
  /** 選択不可行の label の後ろに付ける表示 */
  disabledLabelSuffix?: ReactNode;
  /** 行の表示を差し替える。未指定時は option.label を 1 行で truncate 表示 */
  renderOption?: (option: Options) => ReactNode;
  /** 候補 0 件時の表示。null で非表示（ピン留め行だけが該当している場合など） */
  emptyMessage?: string | null;
  /** リスト先頭に追加するノード（単一選択のピン留め行など） */
  header?: ReactNode;
  /** リスト末尾に追加するノード（ローダー / 末尾到達 / エラー等） */
  footer?: ReactNode;
  /** CommandList の追加クラス（max-h など上書き） */
  className?: string;
  /** スクロール検知（無限スクロール用） */
  onScroll?: (event: UIEvent<HTMLDivElement>) => void;
};

export function AsyncOptionList({
  options,
  selectedValues,
  onToggle,
  selectionMode = "multiple",
  disabledValues,
  disabledLabelSuffix,
  renderOption,
  emptyMessage = "該当する項目がありません",
  header,
  footer,
  className,
  onScroll,
}: AsyncOptionListProps) {
  const isEmpty = options.length === 0;

  return (
    <CommandList
      className={cn("flex max-h-60 flex-col gap-1 p-1", className)}
      onScroll={onScroll}
    >
      {header}
      {options.map((option, index) => {
        const identity = resolveOptionItemIdentity(option, index);
        const selected = includesOptionValue(selectedValues, option.value);
        const disabled = includesOptionValue(disabledValues, option.value);
        const handleToggle = () => {
          if (disabled) return;
          onToggle(option.value);
        };

        return (
          <CommandItem
            key={identity}
            value={identity}
            disabled={disabled}
            onSelect={handleToggle}
            className={cn(
              "cursor-pointer items-center gap-2 rounded-md px-2 py-1.5",
              disabled && "cursor-not-allowed",
            )}
          >
            {selectionMode === "multiple" ? (
              <Checkbox
                checked={selected}
                disabled={disabled}
                onCheckedChange={handleToggle}
                aria-checked={selected}
              />
            ) : (
              <Check className={cn("size-4", selected ? "opacity-100" : "opacity-0")} />
            )}
            <span className="flex min-w-0 flex-1 items-center gap-1">
              {renderOption ? (
                <span className="min-w-0 flex-1">{renderOption(option)}</span>
              ) : (
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              )}
              {disabled && disabledLabelSuffix ? (
                <Span size="xs" tone="muted" className="shrink-0">
                  {disabledLabelSuffix}
                </Span>
              ) : null}
            </span>
          </CommandItem>
        );
      })}
      {isEmpty && emptyMessage !== null && (
        <Span size="sm" tone="muted" align="center" className="block py-6">
          {emptyMessage}
        </Span>
      )}
      {footer}
    </CommandList>
  );
}
