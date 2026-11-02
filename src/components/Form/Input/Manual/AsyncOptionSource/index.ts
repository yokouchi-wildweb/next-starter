// src/components/Form/Input/Manual/AsyncOptionSource/index.ts
//
// 非同期選択肢ソースの共通エンジン + 共通リスト部品。
// 消費者: AsyncComboboxInput / AsyncMultiSelectInput / Overlays/AsyncPickerModal
// ポップオーバーの向き・高さ上限（popoverSide / usePickerPopoverSide）は MultiSelectInput / ComboboxInput も使う

export {
  useAsyncOptionSource,
  INITIAL_ASYNC_OPTION_FETCH_STATE,
} from "./useAsyncOptionSource";
export type {
  AsyncOptionSource,
  AsyncOptionFetchState,
  AsyncOptionFetchStatus,
  AsyncOptionMode,
  UseAsyncOptionSourceOptions,
} from "./useAsyncOptionSource";
export { useSelectionSnapshot } from "./useSelectionSnapshot";
export { AsyncOptionList } from "./AsyncOptionList";
export type { AsyncOptionListProps, AsyncOptionListSelectionMode } from "./AsyncOptionList";
export {
  AsyncOptionInitialState,
  AsyncOptionListFooter,
  isAsyncOptionInitialState,
} from "./AsyncOptionListStates";
export { PendingOptionLabel } from "./PendingOptionLabel";
export {
  decidePopoverSide,
  PICKER_POPOVER_BODY_CLASS,
  POPOVER_SIDE_MARGIN,
} from "./popoverSide";
export type { DecidePopoverSideInput, PopoverVerticalSide } from "./popoverSide";
export { usePickerPopoverSide } from "./usePickerPopoverSide";
