import type React from "react";
import type { EditableGridColumn } from "../../types";
import type { OptionPrimitive } from "@/components/Form/utils";

/**
 * EditableGridCell内部ステート
 */
export type EditableCellState = {
  draftValue: string | null;
  multiDraftValue: OptionPrimitive[] | null;
  error: string | null;
  isEditing: boolean;
  isActive: boolean;
  popupOpen: boolean;
};

/**
 * EditableGridCellイベントハンドラー
 */
export type EditableCellHandlers = {
  handleCommit: (next?: unknown, options?: CommitOptions) => void;
  handleCancel: () => void;
  activateCell: (options?: ActivateCellOptions) => void;
  handleSingleClick: (event: React.MouseEvent) => void;
  handleDoubleClick: (event: React.MouseEvent) => void;
  handleSwitchToggle: (nextValue: boolean) => void;
  handleMultiSelectChange: (values: OptionPrimitive[]) => void;
  setDraftValue: React.Dispatch<React.SetStateAction<string | null>>;
  setMultiDraftValue: React.Dispatch<React.SetStateAction<OptionPrimitive[] | null>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setPopupOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export type CommitOptions = {
  keepEditing?: boolean;
  skipDraftReset?: boolean;
};

export type ActivateCellOptions = {
  enterEditMode?: boolean;
  openSelect?: boolean;
};

/**
 * useEditableCell Props
 */
export type UseEditableCellProps<T> = {
  row: T;
  rowKey: React.Key;
  column: EditableGridColumn<T>;
  onValidChange?: (value: unknown) => void;
};

/**
 * useCellValidation Props
 */
export type UseCellValidationProps<T> = {
  column: EditableGridColumn<T>;
  row: T;
};

/**
 * エディター共通Props
 */
export type BaseEditorProps<T> = {
  row: T;
  rowKey: React.Key;
  column: EditableGridColumn<T>;
  value: string;
  rawValue: unknown;
  placeholder: string;
  error: string | null;
  className?: string;
  paddingClass: string;
  textAlignClass: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onCommit: (next?: unknown, options?: CommitOptions) => void;
  onCancel: () => void;
  onDraftChange: (value: string) => void;
};

/**
 * Select/MultiSelect用の追加Props
 */
export type SelectEditorProps<T> = BaseEditorProps<T> & {
  popupOpen: boolean;
  cellKey: string;
  onPopupOpenChange: (open: boolean) => void;
};

/**
 * Switch用の追加Props
 */
export type SwitchEditorProps<T> = Omit<BaseEditorProps<T>, "value" | "inputRef"> & {
  switchValue: boolean;
  onToggle: (checked: boolean) => void;
};

/**
 * Action用のProps
 */
export type ActionEditorProps<T> = {
  row: T;
  column: EditableGridColumn<T>;
  fallbackPlaceholder: string;
  flexAlignClass?: string;
  paddingClass: string;
};
