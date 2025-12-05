"use client";

import React from "react";
import { normalizeOptionValues, type OptionPrimitive } from "@/components/Form/utils";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/cn";

import { TableCell } from "@/lib/tableSuite/DataTable/components";
import { resolveColumnFlexAlignClass, resolveColumnTextAlignClass } from "../../../types";
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
import { ROW_HEIGHT_TO_PADDING, INPUT_BASE_CLASS } from "./constants";

type EditableGridCellProps<T> = {
  row: T;
  rowKey: React.Key;
  column: EditableGridColumn<T>;
  fallbackPlaceholder: string;
  rowHeight: "xs" | "sm" | "md" | "lg" | "xl";
  onValidChange?: (value: unknown) => void;
};

export function EditableGridCell<T>({
  row,
  rowKey,
  column,
  fallbackPlaceholder,
  rowHeight,
  onValidChange,
}: EditableGridCellProps<T>) {
  // カスタムフックでステート管理
  const { state, handlers, refs, flags, cellKey } = useEditableCell({
    row,
    rowKey,
    column,
    onValidChange,
  });

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
  const paddingClass = ROW_HEIGHT_TO_PADDING[rowHeight] ?? ROW_HEIGHT_TO_PADDING.md;
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
      className={cn(
        "relative p-0 text-sm cursor-default border border-border/70 rounded",
        hasError && "bg-destructive/10 ring-1 ring-inset ring-destructive/50",
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
        className={cn(
          "pointer-events-none absolute inset-0 z-10 rounded border-2 border-transparent",
          !flags.isReadOnly && state.isActive && !state.isEditing && "border-primary/70",
          !flags.isReadOnly && state.isEditing && "border-accent",
        )}
      />

      {/* コンテンツ */}
      <div
        className={cn(
          "group relative flex h-full items-center",
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
            flexAlignClass={flexAlignClass}
            paddingClass={paddingClass}
            className={shouldShowSelectIndicator ? "pr-8" : undefined}
          />
        )}

        {/* エラーインジケーター */}
        {hasError ? <CellErrorIndicator message={state.error ?? ""} /> : null}

        {/* セレクトインジケーター */}
        {shouldShowSelectIndicator ? (
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-primary">
            <ChevronDownIcon className="size-4" aria-hidden />
          </div>
        ) : null}
      </div>
    </TableCell>
  );
}
