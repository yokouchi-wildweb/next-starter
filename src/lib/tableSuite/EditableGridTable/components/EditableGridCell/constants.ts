/**
 * EditableGridCell共通定数
 */

export const ROW_HEIGHT_TO_PADDING: Record<string, string> = {
  xs: "py-0",
  sm: "py-0.5",
  md: "py-1",
  lg: "py-1.5",
  xl: "py-2",
};

export const INPUT_BASE_CLASS =
  "w-full rounded-none border-0 bg-transparent px-2.5 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 truncate";

export const DISPLAY_BASE_CLASS =
  "w-full px-2.5 text-sm flex items-center text-foreground truncate";

export const POPUP_ATTR = "data-editable-grid-popup";

export const CLEAR_VALUE = "__EMPTY__";
