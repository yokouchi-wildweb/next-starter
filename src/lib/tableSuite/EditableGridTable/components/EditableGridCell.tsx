"use client";

import React from "react";
import { Input } from "@/components/Form/Manual";
import { SwitchInput as ManualSwitchInput } from "@/components/Form/Manual/SwitchInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_shadcn/select";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/cn";

import { TableCell } from "@/lib/tableSuite/DataTable/components";
import { resolveColumnFlexAlignClass, resolveColumnTextAlignClass } from "../../types";
import type { EditableGridColumn } from "../types";
import { formatCellValue, parseCellValue, readCellValue } from "../utils/value";
import { CellErrorIndicator } from "./CellErrorIndicator";

type EditableGridCellProps<T> = {
  row: T;
  rowKey: React.Key;
  column: EditableGridColumn<T>;
  fallbackPlaceholder: string;
  rowHeight: "xs" | "sm" | "md" | "lg" | "xl";
  onValidChange?: (value: unknown) => void;
};

const rowHeightToPadding: Record<string, string> = {
  xs: "py-0",
  sm: "py-0.5",
  md: "py-1",
  lg: "py-1.5",
  xl: "py-2",
};

const inputBaseClassName =
  "w-full rounded-none border-0 bg-transparent px-2.5 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 truncate";
const displayBaseClassName = "w-full px-2.5 text-sm flex items-center text-foreground truncate";

const POPUP_ATTR = "data-editable-grid-popup";

export function EditableGridCell<T>({
  row,
  rowKey,
  column,
  fallbackPlaceholder,
  rowHeight,
  onValidChange,
}: EditableGridCellProps<T>) {
  const rawValue = React.useMemo(() => readCellValue(row, column), [column, row]);
  const baseValue = React.useMemo(() => formatCellValue(row, column), [column, row]);
  const [draftValue, setDraftValue] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isActive, setIsActive] = React.useState(false);
  const cellRef = React.useRef<HTMLTableCellElement | null>(null);
  const [selectOpen, setSelectOpen] = React.useState(false);
  const isReadOnly = column.editorType === "readonly";
  const isSwitchEditor = column.editorType === "switch";
  const isSelectEditor = column.editorType === "select";
  const switchPreviousValue = React.useMemo(() => Boolean(rawValue), [rawValue]);
  const textAlignClass = resolveColumnTextAlignClass(column.align);
  const flexAlignClass = resolveColumnFlexAlignClass(column.align);
  const shouldShowSelectIndicator = isSelectEditor && !isEditing && !isReadOnly;

  const inputValue = draftValue ?? baseValue ?? "";

  React.useEffect(() => {
    if (draftValue === null) {
      setError(null);
    }
  }, [baseValue, draftValue]);

  React.useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    }
  }, [isEditing]);

  const cellKey = `${String(rowKey)}-${column.field}`;

  const handleCommit = React.useCallback(
    (next?: string) => {
      const pendingValue = next ?? inputValue;
      const normalized = parseCellValue(pendingValue, row, column);
      const errorMessage = column.validator ? column.validator(normalized, row) : null;

      if (errorMessage) {
        setError(errorMessage);
        return;
      }

      setError(null);
      setDraftValue(null);
      setIsEditing(false);
      setSelectOpen(false);
      onValidChange?.(normalized);
    },
    [column, inputValue, onValidChange, row],
  );

  const handleCancel = () => {
    setDraftValue(null);
    setError(null);
    setIsEditing(false);
    setSelectOpen(false);
  };

  const paddingClass = rowHeightToPadding[rowHeight] ?? rowHeightToPadding.md;

  const sharedInputProps = {
    className: cn(
      inputBaseClassName,
      error && "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
      paddingClass,
      textAlignClass,
    ),
    value: inputValue,
    placeholder: fallbackPlaceholder,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDraftValue(event.target.value),
    onBlur: () => handleCommit(),
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleCommit();
        inputRef.current?.blur();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        handleCancel();
      }
    },
    ref: (node: HTMLInputElement | null) => {
      inputRef.current = node;
    },
  };

  const renderEditor = () => {
    switch (column.editorType) {
      case "text":
        return <Input type="text" {...sharedInputProps} />;
      case "number":
        return <Input type="number" inputMode="decimal" {...sharedInputProps} />;
      case "select":
        const selectValue = inputValue === "" ? undefined : inputValue;

        return (
          <Select
            open={selectOpen}
            onOpenChange={(open) => {
              if (!isEditing) {
                setSelectOpen(false);
                return;
              }
              setSelectOpen(open);
            }}
            value={selectValue}
            onValueChange={(value) => {
              setDraftValue(value);
              handleCommit(value);
            }}
          >
            <SelectTrigger
              className={cn(
                "h-full w-full rounded-none border-0 bg-transparent px-2 py-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
                error && "border border-destructive",
                textAlignClass,
                shouldShowSelectIndicator && "pr-8",
              )}
            >
              <SelectValue placeholder={fallbackPlaceholder} />
            </SelectTrigger>
            <SelectContent {...{ [POPUP_ATTR]: cellKey }}>
              {(column.options ?? []).map((option, index) => {
                const key = option.value === null || option.value === undefined
                  ? `option-${index}`
                  : String(option.value);
                const serializedValue = option.value === null || option.value === undefined
                  ? ""
                  : String(option.value);
                return (
                  <SelectItem key={key} value={serializedValue}>
                    {option.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        );
      case "date":
        return (
          <Input
            type="date"
            {...sharedInputProps}
            onFocus={(event) => {
              if (typeof (event.target as HTMLInputElement).showPicker === "function") {
                (event.target as HTMLInputElement).showPicker();
              }
            }}
          />
        );
      case "time":
        return <Input type="time" {...sharedInputProps} />;
      case "datetime":
        return (
          <Input
            type="datetime-local"
            {...sharedInputProps}
            onFocus={(event) => {
              if (typeof (event.target as HTMLInputElement).showPicker === "function") {
                (event.target as HTMLInputElement).showPicker();
              }
            }}
          />
        );
      case "switch":
        return (
          <div className="px-2 py-1">
            <ManualSwitchInput
              field={{
                value: switchPreviousValue,
                name: `${String(rowKey)}-${column.field}`,
                onChange: (checked: boolean) => handleSwitchToggle(checked),
              }}
              aria-label={`${column.header}の切り替え`}
              activeColor="primary"
            />
          </div>
        );
      default:
        return <Input type="text" {...sharedInputProps} />;
    }
  };

  const hasError = Boolean(error);
  const displayValue = React.useMemo(() => {
    if (column.renderDisplay) {
      return column.renderDisplay(rawValue, row);
    }
    if (column.editorType === "select" && column.options) {
      const option = column.options.find((op) => op.value === String(rawValue));
      if (option) {
        return option.label;
      }
    }
    return baseValue || fallbackPlaceholder;
  }, [baseValue, column, fallbackPlaceholder, rawValue, row]);

  const activateCell = React.useCallback(
    ({ enterEditMode, openSelect }: { enterEditMode?: boolean; openSelect?: boolean } = {}) => {
      if (isReadOnly || isSwitchEditor) {
        return;
      }

      setIsActive(true);

      if (!enterEditMode) {
        return;
      }

      setIsEditing(true);
      if (column.editorType === "select") {
        setSelectOpen(Boolean(openSelect ?? true));
      } else {
        setSelectOpen(false);
      }
    },
    [column.editorType, isReadOnly, isSwitchEditor],
  );

  const handleSingleClick = () => {
    activateCell({ enterEditMode: column.editorType === "select", openSelect: true });
  };

  const handleDoubleClick = () => {
    activateCell({ enterEditMode: true, openSelect: column.editorType === "select" });
  };

  const handleSwitchToggle = React.useCallback(
    (nextValue: boolean) => {
      if (!isSwitchEditor) {
        return;
      }

      const proceed = column.onToggleRequest
        ? column.onToggleRequest({
            row,
            rowKey,
            field: column.field,
            nextValue,
            previousValue: switchPreviousValue,
          })
        : true;

      Promise.resolve(proceed)
        .then((allowed) => {
          if (!allowed) {
            return;
          }
          setIsActive(true);
          setIsEditing(false);
          setSelectOpen(false);
          onValidChange?.(nextValue);
        })
        .catch((error) => {
          if (process.env.NODE_ENV !== "production") {
            console.error("EditableGridTable: switch toggle request failed", error);
          }
        });
    },
    [column, isSwitchEditor, onValidChange, row, rowKey, switchPreviousValue],
  );

  React.useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!cellRef.current) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest(`[${POPUP_ATTR}="${cellKey}"]`)) {
        return;
      }
      if (!cellRef.current.contains(target as Node)) {
        if (isEditing) {
          handleCommit();
        }
        setIsActive(false);
        setIsEditing(false);
        setSelectOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [handleCommit, isEditing]);

  const shouldRenderEditor = isEditing || isSwitchEditor;

  return (
    <TableCell
      key={cellKey}
      className={cn(
        "relative p-0 text-sm cursor-default border border-border/70 rounded",
        hasError && "bg-destructive/10 ring-1 ring-inset ring-destructive/50",
        textAlignClass,
      )}
      style={column.width ? { width: column.width } : undefined}
      onClick={isReadOnly || isSwitchEditor ? undefined : handleSingleClick}
      onDoubleClick={isReadOnly || isSwitchEditor ? undefined : handleDoubleClick}
      aria-readonly={isReadOnly || undefined}
      ref={cellRef}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-10 rounded border-2 border-transparent",
          !isReadOnly && isActive && !isEditing && "border-primary/70",
          !isReadOnly && isEditing && "border-accent",
        )}
      />
      <div
        className={cn(
          "group relative flex h-full items-center",
          flexAlignClass,
          !flexAlignClass && isSwitchEditor && "justify-center",
        )}
      >
        {shouldRenderEditor && !isReadOnly ? (
          renderEditor()
        ) : (
          <div
            className={cn(
              displayBaseClassName,
              isReadOnly && "bg-muted/50 text-muted-foreground",
              flexAlignClass,
              !flexAlignClass && isSwitchEditor && "justify-center",
              paddingClass,
              shouldShowSelectIndicator && "pr-8",
            )}
          >
            {displayValue}
          </div>
        )}
        {hasError ? <CellErrorIndicator message={error ?? ""} /> : null}
        {shouldShowSelectIndicator ? (
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-primary">
            <ChevronDownIcon className="size-4" aria-hidden />
          </div>
        ) : null}
      </div>
    </TableCell>
  );
}
