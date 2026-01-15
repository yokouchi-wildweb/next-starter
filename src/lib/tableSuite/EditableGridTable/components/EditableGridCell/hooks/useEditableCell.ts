"use client";

import React from "react";
import { normalizeOptionValues, type OptionPrimitive } from "@/components/Form/utils";
import { parseCellValue, readCellValue } from "../../../utils/value";
import { POPUP_ATTR } from "../constants";
import type {
  UseEditableCellProps,
  EditableCellState,
  EditableCellHandlers,
  CommitOptions,
  ActivateCellOptions,
} from "../types";

export function useEditableCell<T>({
  row,
  rowKey,
  column,
  onValidChange,
}: UseEditableCellProps<T>) {
  // ステート管理
  const [draftValue, setDraftValue] = React.useState<string | null>(null);
  const [multiDraftValue, setMultiDraftValue] = React.useState<OptionPrimitive[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isActive, setIsActive] = React.useState(false);
  const [popupOpen, setPopupOpen] = React.useState(false);

  // Refs
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const cellRef = React.useRef<HTMLTableCellElement | null>(null);

  // エディター型判定
  const isActionEditor = column.editorType === "action";
  const isReadOnly = column.editorType === "readonly" || isActionEditor;
  const isSwitchEditor = column.editorType === "switch";
  const isMultiSelectEditor = column.editorType === "multi-select";

  const cellKey = `${String(rowKey)}-${column.field}`;

  // コミット処理
  const handleCommit = React.useCallback(
    (next?: unknown, options?: CommitOptions) => {
      // 値の変更がない場合（引数なし＆draftValueがnull）は、編集モードを終了するのみ
      // onValidChangeは呼ばず、元の値を維持する
      if (typeof next === "undefined" && draftValue === null) {
        setError(null);
        if (!options?.keepEditing) {
          setIsEditing(false);
          setPopupOpen(false);
        }
        return;
      }

      const pendingValue = typeof next === "undefined" ? draftValue : next;
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
    [column, draftValue, onValidChange, row],
  );

  // キャンセル処理
  const handleCancel = React.useCallback(() => {
    setDraftValue(null);
    setMultiDraftValue(null);
    setError(null);
    setIsEditing(false);
    setPopupOpen(false);
  }, []);

  // セルのアクティブ化
  const activateCell = React.useCallback(
    ({ enterEditMode, openSelect }: ActivateCellOptions = {}) => {
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

  // ポップアップ判定
  const isEventFromPopup = React.useCallback(
    (target: EventTarget | null) =>
      target instanceof HTMLElement && Boolean(target.closest(`[${POPUP_ATTR}="${cellKey}"]`)),
    [cellKey],
  );

  // シングルクリック
  const handleSingleClick = React.useCallback(
    (event: React.MouseEvent) => {
      if (isEventFromPopup(event.target)) {
        return;
      }
      const isPopupEditor = column.editorType === "select" || column.editorType === "multi-select";
      activateCell({
        enterEditMode: isPopupEditor,
        openSelect: isPopupEditor,
      });
    },
    [activateCell, column.editorType, isEventFromPopup],
  );

  // ダブルクリック
  const handleDoubleClick = React.useCallback(
    (event: React.MouseEvent) => {
      if (isEventFromPopup(event.target)) {
        return;
      }
      const isPopupEditor = column.editorType === "select" || column.editorType === "multi-select";
      activateCell({ enterEditMode: true, openSelect: isPopupEditor });
    },
    [activateCell, column.editorType, isEventFromPopup],
  );

  // スイッチトグル
  const handleSwitchToggle = React.useCallback(
    (nextValue: boolean) => {
      if (!isSwitchEditor) {
        return;
      }

      const rawValue = column.getValue ? column.getValue(row) : (row as Record<string, unknown>)[column.field];
      const previousValue = Boolean(rawValue);

      const proceed = column.onToggleRequest
        ? column.onToggleRequest({
            row,
            rowKey,
            field: column.field,
            nextValue,
            previousValue,
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
    [column, isSwitchEditor, onValidChange, row, rowKey],
  );

  // マルチセレクト変更
  const handleMultiSelectChange = React.useCallback(
    (values: OptionPrimitive[]) => {
      setMultiDraftValue(values);
      handleCommit(values, { keepEditing: true, skipDraftReset: true });
    },
    [handleCommit],
  );

  // エフェクト: draftValueクリア時にエラーもクリア
  React.useEffect(() => {
    if (draftValue === null) {
      setError(null);
    }
  }, [draftValue]);

  // エフェクト: multiDraftValueのリセット
  React.useEffect(() => {
    if (!isEditing || !isMultiSelectEditor) {
      setMultiDraftValue(null);
    }
  }, [isEditing, isMultiSelectEditor]);

  // エフェクト: 編集モード時のフォーカス
  React.useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    }
  }, [isEditing]);

  // エフェクト: 外部クリック検知
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
            const rawValue = column.getValue ? column.getValue(row) : (row as Record<string, unknown>)[column.field];
            const normalizedMultiValue = normalizeOptionValues((rawValue as OptionPrimitive[] | null) ?? null);
            handleCommit(multiDraftValue ?? normalizedMultiValue);
          } else if (draftValue !== null) {
            // draftValueがある場合、バリデーションを実行
            const normalized = parseCellValue(draftValue, row, column);
            const draftError = column.validator?.(normalized, row) ?? null;

            if (draftError) {
              // draftValueでエラー → 元の値で再バリデーション
              const rawValue = readCellValue(row, column);
              const originalError = column.validator?.(rawValue, row) ?? null;
              setError(originalError);
              setDraftValue(null);
            } else {
              // draftValueでOK → 通常コミット
              handleCommit(draftValue);
            }
          } else {
            // draftValueがnull → 編集終了のみ
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
  }, [cellKey, column, draftValue, handleCommit, isEditing, isMultiSelectEditor, multiDraftValue, row]);

  const state: EditableCellState = {
    draftValue,
    multiDraftValue,
    error,
    isEditing,
    isActive,
    popupOpen,
  };

  const handlers: EditableCellHandlers = {
    handleCommit,
    handleCancel,
    activateCell,
    handleSingleClick,
    handleDoubleClick,
    handleSwitchToggle,
    handleMultiSelectChange,
    setDraftValue,
    setMultiDraftValue,
    setError,
    setIsEditing,
    setPopupOpen,
  };

  const refs = {
    inputRef,
    cellRef,
  };

  const flags = {
    isActionEditor,
    isReadOnly,
    isSwitchEditor,
    isMultiSelectEditor,
  };

  return {
    state,
    handlers,
    refs,
    flags,
    cellKey,
  };
}
