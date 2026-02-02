"use client";

import React from "react";
import { normalizeOptionValues, type OptionPrimitive } from "@/components/Form/utils";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/cn";

import { TableCell, CellClickOverlay } from "@/lib/tableSuite";
import {
  resolveColumnFlexAlignClass,
  resolveColumnTextAlignClass,
  resolvePaddingClass,
  type PaddingSize,
} from "../../../types";
import type { EditableGridColumn } from "../../types";
import { formatCellValue, readCellValue } from "../../utils/value";
import { CellErrorIndicator } from "../CellErrorIndicator";

import { useEditableCell } from "./hooks/useEditableCell";
import { TextEditor } from "./editors/TextEditor";
import { SelectEditor } from "./editors/SelectEditor";
import { MultiSelectEditor } from "./editors/MultiSelectEditor";
import { DateTimeEditor } from "./editors/DateTimeEditor";
import { SwitchEditor } from "./editors/SwitchEditor";
import { ActionEditor } from "./editors/ActionEditor";
import { CellDisplay } from "./display/CellDisplay";
import { INPUT_BASE_CLASS } from "./constants";

type EditableGridCellProps<T> = {
  row: T;
  rowKey: React.Key;
  column: EditableGridColumn<T>;
  fallbackPlaceholder: string;
  cellPaddingX: PaddingSize;
  cellPaddingY: PaddingSize;
  highlightReadonly?: boolean;
  onValidChange?: (value: unknown) => void;
};

export function EditableGridCell<T>({
  row,
  rowKey,
  column,
  fallbackPlaceholder,
  cellPaddingX,
  cellPaddingY,
  highlightReadonly = true,
  onValidChange,
}: EditableGridCellProps<T>) {
  // カスタムフックでステート管理
  const { state, handlers, refs, flags, cellKey } = useEditableCell({
    row,
    rowKey,
    column,
    onValidChange,
  });

  // 開発時警告: readonly 以外で cellAction を指定した場合
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production" && column.cellAction && !flags.isReadOnly) {
      console.warn(
        `EditableGridCell: cellAction は editorType: "readonly" の場合のみ有効です。field: "${column.field}" では無視されます。`,
      );
    }
  }, [column.cellAction, column.field, flags.isReadOnly]);

  // 値の計算
  const rawValue = React.useMemo(() => readCellValue(row, column), [column, row]);
  const baseValue = React.useMemo(() => formatCellValue(row, column), [column, row]);
  const inputValue = state.draftValue ?? baseValue ?? "";
  const switchValue = React.useMemo(() => Boolean(rawValue), [rawValue]);
  const normalizedMultiValue = React.useMemo(() => {
    if (!flags.isMultiSelectEditor) {
      return [];
    }
    if (state.multiDraftValue) {
      return state.multiDraftValue;
    }
    return normalizeOptionValues((rawValue as OptionPrimitive[] | null) ?? null);
  }, [flags.isMultiSelectEditor, state.multiDraftValue, rawValue]);

  // スタイリング
  const textAlignClass = resolveColumnTextAlignClass(column.align) ?? "";
  const flexAlignClass = resolveColumnFlexAlignClass(column.align);
  const paddingClass = resolvePaddingClass(cellPaddingX, cellPaddingY);
  const shouldShowSelectIndicator =
    column.editorType === "select" && !state.isEditing && !flags.isReadOnly;

  // エディター用の共通Props
  const baseEditorProps = {
    row,
    rowKey,
    column,
    value: inputValue,
    rawValue,
    placeholder: fallbackPlaceholder,
    error: state.error,
    className: cn(
      INPUT_BASE_CLASS,
      state.error && "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
      paddingClass,
      textAlignClass,
    ),
    paddingClass,
    textAlignClass,
    inputRef: refs.inputRef,
    onCommit: handlers.handleCommit,
    onCancel: handlers.handleCancel,
    onDraftChange: handlers.setDraftValue,
  };

  const selectEditorProps = {
    ...baseEditorProps,
    popupOpen: state.popupOpen,
    cellKey,
    onPopupOpenChange: (open: boolean) => {
      if (!state.isEditing) {
        handlers.setPopupOpen(false);
        return;
      }
      handlers.setPopupOpen(open);
    },
  };

  // エディターのレンダリング
  const renderEditor = () => {
    switch (column.editorType) {
      case "text":
        return <TextEditor {...baseEditorProps} type="text" />;
      case "number":
        return <TextEditor {...baseEditorProps} type="number" inputMode="decimal" />;
      case "select":
        return <SelectEditor {...selectEditorProps} />;
      case "multi-select":
        return <MultiSelectEditor {...selectEditorProps} />;
      case "date":
        return <DateTimeEditor {...baseEditorProps} type="date" />;
      case "time":
        return <DateTimeEditor {...baseEditorProps} type="time" />;
      case "datetime":
        return <DateTimeEditor {...baseEditorProps} type="datetime" />;
      case "switch":
        return (
          <SwitchEditor
            rowKey={rowKey}
            column={column}
            row={row}
            rawValue={rawValue}
            placeholder={fallbackPlaceholder}
            error={state.error}
            paddingClass={paddingClass}
            textAlignClass={textAlignClass}
            switchValue={switchValue}
            onToggle={handlers.handleSwitchToggle}
            onCommit={handlers.handleCommit}
            onCancel={handlers.handleCancel}
            onDraftChange={handlers.setDraftValue}
          />
        );
      default:
        return <TextEditor {...baseEditorProps} type="text" />;
    }
  };

  const hasError = Boolean(state.error);
  const shouldRenderEditor = (state.isEditing || flags.isSwitchEditor) && !flags.isActionEditor;

  return (
    <TableCell
      key={cellKey}
      data-editable-cell
      data-field={column.field}
      data-editor-type={column.editorType}
      data-readonly={flags.isReadOnly || undefined}
      data-editing={state.isEditing || undefined}
      data-active={state.isActive || undefined}
      className={cn(
        "relative p-0 text-sm cursor-default border border-border/70 rounded",
        hasError && "bg-destructive/10 ring-1 ring-inset ring-destructive/50",
        highlightReadonly && flags.isReadOnly && "bg-muted/50",
        flags.isReadOnly && column.cellAction && "group",
        textAlignClass,
      )}
      style={column.width ? { width: column.width } : undefined}
      onClick={flags.isReadOnly || flags.isSwitchEditor ? undefined : handlers.handleSingleClick}
      onDoubleClick={
        flags.isReadOnly || flags.isSwitchEditor ? undefined : handlers.handleDoubleClick
      }
      aria-readonly={flags.isReadOnly || undefined}
      ref={refs.cellRef}
    >
      {/* アクティブ/編集中の枠線 */}
      <div
        data-cell-border
        className={cn(
          "pointer-events-none absolute inset-0 z-10 rounded border-2 border-transparent",
          !flags.isReadOnly && state.isActive && !state.isEditing && "border-primary/70",
          !flags.isReadOnly && state.isEditing && "border-accent",
        )}
      />

      {/* コンテンツ */}
      <div
        data-cell-content
        className={cn(
          "group flex items-center",
          !flags.isReadOnly && "absolute inset-0",
          flexAlignClass,
          !flexAlignClass && flags.isSwitchEditor && "justify-center",
        )}
      >
        {shouldRenderEditor && !flags.isReadOnly ? (
          renderEditor()
        ) : flags.isActionEditor ? (
          <ActionEditor
            row={row}
            column={column}
            fallbackPlaceholder={fallbackPlaceholder}
            flexAlignClass={flexAlignClass}
            paddingClass={paddingClass}
          />
        ) : (
          <CellDisplay
            rawValue={rawValue}
            baseValue={baseValue}
            row={row}
            column={column}
            fallbackPlaceholder={fallbackPlaceholder}
            isReadOnly={flags.isReadOnly}
            highlightReadonly={highlightReadonly}
            flexAlignClass={flexAlignClass}
            paddingClass={paddingClass}
            className={shouldShowSelectIndicator ? "pr-8" : undefined}
          />
        )}

        {/* エラーインジケーター */}
        {hasError ? <CellErrorIndicator message={state.error ?? ""} /> : null}

        {/* セレクトインジケーター */}
        {shouldShowSelectIndicator ? (
          <div data-select-indicator className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-primary">
            <ChevronDownIcon className="size-4" aria-hidden />
          </div>
        ) : null}
      </div>

      {/* セルアクションオーバーレイ（readonly のみ） */}
      {flags.isReadOnly && column.cellAction && (
        <CellClickOverlay
          onClick={() => column.cellAction!.onClick(row)}
          indicator={
            typeof column.cellAction.indicator === "function"
              ? column.cellAction.indicator(row)
              : column.cellAction.indicator
          }
          fullWidth={column.cellAction.fullWidth}
        />
      )}
    </TableCell>
  );
}
