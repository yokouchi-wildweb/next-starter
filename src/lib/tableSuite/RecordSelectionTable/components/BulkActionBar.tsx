import React from "react";
import { X } from "lucide-react";

import { Button } from "@/components/Form/Button";
import { SwitchInput } from "@/components/Form/Input/Manual";
import { Checkbox } from "@/components/Primitives/Checkbox";
import { cn } from "@/lib/cn";

import type { SelectionMode } from "../hooks/useSelectionMode";

export type BulkActionSelection<T> = {
  /** 選択されたレコードのキー配列 */
  selectedKeys: React.Key[];
  /** 選択されたレコードのオブジェクト配列 */
  selectedRows: T[];
  /** 選択されたレコードのID配列（文字列） */
  selectedIds: string[];
  /** 選択件数 */
  count: number;
  /** 選択をクリアする関数 */
  clear: () => void;
};

export type BulkActionBarSpacing = "sm" | "md" | "lg";

export type BulkActionBarPosition = "top" | "bottom" | "both";

const SPACING_MB: Record<BulkActionBarSpacing, string> = {
  sm: "mb-1",
  md: "mb-2",
  lg: "mb-3",
};

const SPACING_MT: Record<BulkActionBarSpacing, string> = {
  sm: "mt-1",
  md: "mt-2",
  lg: "mt-3",
};

export type BulkActionBarProps<T> = {
  selection: BulkActionSelection<T>;
  bulkActions: (selection: BulkActionSelection<T>) => React.ReactNode;
  /** テーブルとの余白 @default "md" */
  spacing?: BulkActionBarSpacing;
  /** テーブルの上か下か @default "top" */
  placement?: "top" | "bottom";
  /** 選択の出し方(onSelect = 選んだ時だけ帯 / always = いつも / toggle = いつも + 選択モードの切り替え) @default "onSelect" */
  mode?: SelectionMode;
  /** toggle の切り替えの今の値(入 = チェックと操作を出す) */
  selectionOn?: boolean;
  onSelectionOnChange?: (on: boolean) => void;
  /** 帯の左の「すべて選択」(見出しの行の無い一覧で使う) */
  selectAll?: { checked: boolean; indeterminate: boolean; onToggle: (checked: boolean) => void; label?: string };
  /** 0件選択時のメッセージ @default "行を選択して一括処理を実行" */
  emptyMessage?: string;
  /** スクロールしても見える位置に留めるかどうか @default false */
  sticky?: boolean;
};

export function BulkActionBar<T>({
  selection,
  bulkActions,
  spacing = "md",
  placement = "top",
  mode = "onSelect",
  selectionOn = true,
  onSelectionOnChange,
  selectAll,
  emptyMessage = "行を選択して一括処理を実行",
  sticky = false,
}: BulkActionBarProps<T>) {
  const hasSelection = selection.count > 0;
  const isVisible = mode !== "onSelect" || hasSelection;
  const spacingClass = placement === "top" ? SPACING_MB[spacing] : SPACING_MT[spacing];

  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-[600ms] ease-out",
        isVisible ? `${spacingClass} max-h-20 opacity-100` : "mb-0 max-h-0 opacity-0",
        // バーの色は半透明なので、下を流れる行が透けないよう不透明の土台を敷く
        sticky && "content-layer sticky bg-background",
        sticky && (placement === "top" ? "top-0" : "bottom-0")
      )}
    >
      {/* 中の行の高さの下限 = sm のボタン(h-9)+ 上下の余白(py-3)+ 枠(1px × 2)。選択の on / off でボタンや「選択解除」が出入りしても
          バーの高さが変わってがたつかないように */}
      <div
        className={cn(
          "flex min-h-[3.875rem] items-center gap-4 rounded-lg border px-4 py-3 transition-colors",
          hasSelection
            ? "border-primary/20 bg-primary/5"
            : "border-muted-foreground/20 bg-muted/50"
        )}
      >
        {/* 左側: 共通部分 */}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {mode === "toggle" ? (
            <SwitchInput value={selectionOn} onChange={(on) => onSelectionOnChange?.(on)} label="選択モード" />
          ) : null}
          {selectAll && selectionOn ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={selectAll.indeterminate ? "indeterminate" : selectAll.checked}
                onCheckedChange={(checked) => selectAll.onToggle(checked === true)}
                aria-label={selectAll.label ?? "すべて選択"}
              />
              {selectAll.label ?? "すべて選択"}
            </label>
          ) : null}
          {!selectionOn ? null : hasSelection ? (
            <>
              <span className="font-medium text-primary">{selection.count}件選択中</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={selection.clear}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4" />
                選択解除
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground">{emptyMessage}</span>
          )}
        </div>

        {/* 右側: カスタムアクション */}
        {selectionOn ? <div className="flex gap-2">{bulkActions(selection)}</div> : null}
      </div>
    </div>
  );
}
