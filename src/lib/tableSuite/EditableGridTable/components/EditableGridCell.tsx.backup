"use client";

import React from "react";
import { Input } from "@/components/Form/Manual";
import { MultiSelectInput } from "@/components/Form/Manual/MultiSelectInput";
import type { MultiSelectInputProps } from "@/components/Form/Manual/MultiSelectInput";
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
import {
  normalizeOptionValues,
  serializeOptionValue,
  type OptionPrimitive,
} from "@/components/Form/utils";

import { TableCell, TableCellAction } from "@/lib/tableSuite/DataTable/components";
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
const CLEAR_VALUE = "__EMPTY__";

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
  const [multiDraftValue, setMultiDraftValue] = React.useState<OptionPrimitive[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isActive, setIsActive] = React.useState(false);
  const cellRef = React.useRef<HTMLTableCellElement | null>(null);
  const [popupOpen, setPopupOpen] = React.useState(false);
  const isActionEditor = column.editorType === "action";
  const isReadOnly = column.editorType === "readonly" || isActionEditor;
  const isSwitchEditor = column.editorType === "switch";
  const isSelectEditor = column.editorType === "select";
  const isMultiSelectEditor = column.editorType === "multi-select";
  const switchPreviousValue = React.useMemo(() => Boolean(rawValue), [rawValue]);
  const textAlignClass = resolveColumnTextAlignClass(column.align);
  const flexAlignClass = resolveColumnFlexAlignClass(column.align);
  const shouldShowSelectIndicator = isSelectEditor && !isEditing && !isReadOnly;

  const inputValue = draftValue ?? baseValue ?? "";
  const normalizedMultiValue = React.useMemo(() => {
    if (!isMultiSelectEditor) {
      return [];
    }
    if (multiDraftValue) {
      return multiDraftValue;
    }
    return normalizeOptionValues((rawValue as OptionPrimitive[] | null) ?? null);
  }, [isMultiSelectEditor, multiDraftValue, rawValue]);

  React.useEffect(() => {
    if (draftValue === null) {
      setError(null);
    }
  }, [baseValue, draftValue]);

  React.useEffect(() => {
    if (!isEditing || !isMultiSelectEditor) {
      setMultiDraftValue(null);
    }
  }, [isEditing, isMultiSelectEditor]);

  React.useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    }
  }, [isEditing]);

  const cellKey = `${String(rowKey)}-${column.field}`;

  const handleCommit = React.useCallback(
    (next?: unknown, options?: { keepEditing?: boolean; skipDraftReset?: boolean }) => {
      const pendingValue = typeof next === "undefined" ? inputValue : next;
      const normalized = parseCellValue(pendingValue, row, column);
      const errorMessage = column.validator ? column.validator(normalized, row) : null;

      if (errorMessage) {
        setError(errorMessage);
        return;
      }

      setError(null);
      if (!options?.skipDraftReset) {
        setDraftValue(null);
      }
      if (!options?.keepEditing) {
        setIsEditing(false);
        setPopupOpen(false);
      }
      onValidChange?.(normalized);
    },
    [column, inputValue, onValidChange, row],
  );

  const handleCancel = () => {
    setDraftValue(null);
    setMultiDraftValue(null);
    setError(null);
    setIsEditing(false);
    setPopupOpen(false);
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

  const handleMultiSelectChange = React.useCallback(
    (values: OptionPrimitive[]) => {
      setMultiDraftValue(values);
      handleCommit(values, { keepEditing: true, skipDraftReset: true });
    },
    [handleCommit],
  );

  const renderEditor = () => {
    switch (column.editorType) {
      case "text":
        return <Input type="text" {...sharedInputProps} />;
      case "number":
        return <Input type="number" inputMode="decimal" {...sharedInputProps} />;
      case "select": {
        const allowNullSelection = column.allowNullSelection ?? false;
        const baseSelectValue =
          rawValue === null || typeof rawValue === "undefined"
            ? allowNullSelection
              ? CLEAR_VALUE
              : ""
            : serializeOptionValue(rawValue as OptionPrimitive);
        const currentSelectValue = draftValue ?? baseSelectValue;
        const selectValue = currentSelectValue === "" ? undefined : currentSelectValue;
        const nullLabel = column.nullOptionLabel ?? "未選択（null）";

        return (
          <Select
            open={popupOpen}
            onOpenChange={(open) => {
              if (!isEditing) {
                setPopupOpen(false);
                return;
              }
              setPopupOpen(open);
            }}
            value={selectValue}
            onValueChange={(value) => {
              setDraftValue(value);
              const nextValue = allowNullSelection && value === CLEAR_VALUE ? null : value;
              handleCommit(nextValue);
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
              {allowNullSelection ? (
                <SelectItem value={CLEAR_VALUE}>{nullLabel}</SelectItem>
              ) : null}
              {(column.options ?? []).map((option, index) => {
                const serializedValue = serializeOptionValue(option.value as OptionPrimitive);
                const key = serializedValue || `option-${index}`;
                return (
                  <SelectItem key={key} value={serializedValue}>
                    {option.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        );
      }
      case "multi-select": {
        const fieldName = `${String(rowKey)}-${column.field}`;
        return (
          <div className="w-full px-2 py-1">
            <MultiSelectInput
              field={{
                value: normalizedMultiValue,
                name: fieldName,
                onChange: handleMultiSelectChange,
              }}
              options={column.options ?? []}
              placeholder={fallbackPlaceholder}
              open={popupOpen}
              onOpenChange={(nextOpen) => {
                if (!isEditing) {
                  setPopupOpen(false);
                  return;
                }
                setPopupOpen(nextOpen);
              }}
              popoverContentProps={
                {
                  [POPUP_ATTR]: cellKey,
                } as MultiSelectInputProps["popoverContentProps"]
              }
              className="w-full"
            />
          </div>
        );
      }
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
    if (column.editorType === "select") {
      if (
        (rawValue === null || typeof rawValue === "undefined") &&
        column.allowNullSelection
      ) {
        return column.nullOptionLabel ?? fallbackPlaceholder;
      }
      if (column.options) {
        const serializedRaw = serializeOptionValue(rawValue as OptionPrimitive | null | undefined);
        const option = column.options.find(
          (op) => serializeOptionValue(op.value as OptionPrimitive) === serializedRaw,
        );
        if (option) {
          return option.label;
        }
      }
    }
    if (column.editorType === "multi-select" && column.options) {
      const values = Array.isArray(rawValue) ? (rawValue as OptionPrimitive[]) : [];
      if (values.length === 0) {
        return fallbackPlaceholder;
      }
      const labels = values.map((entry) => {
        const serializedValue = serializeOptionValue(entry);
        const match = column.options?.find(
          (op) => serializeOptionValue(op.value as OptionPrimitive) === serializedValue,
        );
        return match?.label ?? serializedValue;
      });
      return labels.join(", ");
    }
    if (column.editorType === "multi-select" && Array.isArray(rawValue)) {
      return rawValue.map((entry) => String(entry)).join(", ") || fallbackPlaceholder;
    }
    return baseValue || fallbackPlaceholder;
  }, [baseValue, column, fallbackPlaceholder, rawValue, row]);

  const isEventFromPopup = (target: EventTarget | null) =>
    target instanceof HTMLElement && Boolean(target.closest(`[${POPUP_ATTR}="${cellKey}"]`));

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
      if (column.editorType === "select" || column.editorType === "multi-select") {
        setPopupOpen(Boolean(openSelect ?? true));
      } else {
        setPopupOpen(false);
      }
    },
    [column.editorType, isReadOnly, isSwitchEditor],
  );

  const handleSingleClick = (event: React.MouseEvent) => {
    if (isEventFromPopup(event.target)) {
      return;
    }
    const isPopupEditor = column.editorType === "select" || column.editorType === "multi-select";
    activateCell({
      enterEditMode: isPopupEditor,
      openSelect: isPopupEditor,
    });
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    if (isEventFromPopup(event.target)) {
      return;
    }
    const isPopupEditor = column.editorType === "select" || column.editorType === "multi-select";
    activateCell({ enterEditMode: true, openSelect: isPopupEditor });
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
          setPopupOpen(false);
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
          if (isMultiSelectEditor) {
            handleCommit(normalizedMultiValue);
          } else {
            handleCommit();
          }
        }
        setIsActive(false);
        setIsEditing(false);
        setPopupOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [handleCommit, isEditing, isMultiSelectEditor, normalizedMultiValue]);

  const shouldRenderEditor = (isEditing || isSwitchEditor) && !isActionEditor;

  const renderActionDisplay = () => {
    if (!isActionEditor) {
      return null;
    }

    if (!column.renderAction) {
      return (
        <div
          className={cn(
            displayBaseClassName,
            "text-muted-foreground",
            flexAlignClass,
            paddingClass,
          )}
        >
          {fallbackPlaceholder}
        </div>
      );
    }

    return (
      <TableCellAction className={cn("w-full px-2", flexAlignClass, paddingClass)}>
        {column.renderAction(row)}
      </TableCellAction>
    );
  };

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
        ) : isActionEditor ? (
          renderActionDisplay()
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
