// src/lib/toast/target.ts
//
// トーストの領域の印と「押した所がトーストの中か」の判定(当議会 D189)。
// トーストは浮く物(floating)より上の toast の層に出るので、モーダル・ポップオーバーを開いたままトーストを押せる。
// その押しを浮く物の「外押し」にすると開いている物が閉じてしまうため、浮く物の土台(Primitives の Dialog・Popover)が
// 外押しの判定でこの関数を呼び、トーストの中なら外押しにしない。

/** トーストの領域(GlobalToast の外側の要素)の data-slot */
export const TOAST_REGION_SLOT = "toast-region";

/** 押した所(イベントの target)がトーストの領域の中か */
export function isToastTarget(target: EventTarget | null | undefined): boolean {
  if (!target || typeof (target as Element).closest !== "function") return false;
  return (target as Element).closest(`[data-slot="${TOAST_REGION_SLOT}"]`) !== null;
}
