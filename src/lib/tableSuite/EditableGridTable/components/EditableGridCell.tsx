"use client";

import React from "react";
import { Input } from "@/components/Form/Manual";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Shadcn/select";
import { cn } from "@/lib/cn";

import { TableCell } from "../../DataTable/components";
import type { EditableGridColumn } from "../types";
import { formatCellValue, parseCellValue, readCellValue } from "../utils/value";
import { CellErrorIndicator } from "./CellErrorIndicator";

type EditableGridCellProps<T> = {
  row: T;
  rowKey: React.Key;
  column: EditableGridColumn<T>;
  fallbackPlaceholder: string;
  onValidChange?: (value: unknown) => void;
};

const inputBaseClassName =
  "h-9 w-full rounded-none border-0 bg-transparent px-2.5 py-1 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 truncate";
const displayBaseClassName =
  "h-9 w-full px-2.5 py-1 text-sm flex items-center text-foreground truncate";

const POPUP_ATTR = "data-editable-grid-popup";

export function EditableGridCell<T>({
  row,
  rowKey,
  column,
  fallbackPlaceholder,
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
      onValidChange?.(normalized);
    },
    [column, inputValue, onValidChange, row],
  );

  const handleCancel = () => {
    setDraftValue(null);
    setError(null);
    setIsEditing(false);
  };

  const sharedInputProps = {
    className: cn(
      inputBaseClassName,
      error && "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
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
        const EMPTY_VALUE = "__EMPTY__";
        const selectValue = inputValue === "" ? EMPTY_VALUE : inputValue;

        return (
          <Select
            value={selectValue}
            onValueChange={(value) => {
              const resolvedValue = value === EMPTY_VALUE ? "" : value;
              setDraftValue(resolvedValue);
              handleCommit(resolvedValue);
            }}
          >
            <SelectTrigger
              className={cn(
                "h-full w-full rounded-none border-0 bg-transparent px-2 py-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
                error && "border border-destructive",
              )}
            >
              <SelectValue placeholder={fallbackPlaceholder} />
            </SelectTrigger>
            <SelectContent {...{ [POPUP_ATTR]: cellKey }}>
              <SelectItem value={EMPTY_VALUE}>
                {column.placeholder ?? fallbackPlaceholder}
              </SelectItem>
              {(column.options ?? []).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
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

  const handleSingleClick = () => {
    setIsActive(true);
  };

  const handleDoubleClick = () => {
    setIsActive(true);
    setIsEditing(true);
  };

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
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [handleCommit, isEditing]);

  return (
    <TableCell
      key={cellKey}
      className={cn(
        "relative p-0 text-sm cursor-default border border-border/70 rounded",
        hasError && "bg-destructive/10 ring-1 ring-inset ring-destructive/50",
      )}
      style={column.width ? { width: column.width } : undefined}
      onClick={handleSingleClick}
      onDoubleClick={handleDoubleClick}
      ref={cellRef}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-10 rounded border-2 border-transparent",
          isActive && !isEditing && "border-primary/70",
          isEditing && "border-accent",
        )}
      />
      <div className={cn("group relative flex h-full items-center")}>
        {isEditing ? (
          renderEditor()
        ) : (
          <div className={displayBaseClassName}>{displayValue}</div>
        )}
        {hasError ? <CellErrorIndicator message={error ?? ""} /> : null}
      </div>
    </TableCell>
  );
}
