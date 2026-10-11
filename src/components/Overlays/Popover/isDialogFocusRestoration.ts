// src/components/Overlays/Popover/isDialogFocusRestoration.ts

/**
 * Dialog/Modal 内に入れ子になった Popover が「FocusScope のフォーカス復帰」で閉じるのを防ぐための判定。
 *
 * 背景（Radix FocusScope × DismissableLayer の相互作用）:
 *   Popover 内のボタンがクリック直後に disabled になり、同時に中身（アイコン→スピナー等）が差し替わると、
 *   activeElement が body に落ちる → Dialog の FocusScope（trapped）の MutationObserver が
 *   「ノード削除 + activeElement===body」を検知して DialogContent コンテナ自身へ focus する →
 *   コンテナは Popover の React ツリー外なので DismissableLayer が focusin を FOCUS_OUTSIDE 扱いし、
 *   処理中の Popover が勝手に閉じる。
 *
 * 判定の根拠:
 *   Dialog コンテナ要素（tabIndex=-1）自身に focusin が着地するのは FocusScope による復帰のときだけで、
 *   ユーザー操作では起きない（Tab は tabIndex=-1 に止まらず、本体クリックは pointerdown-outside が先に
 *   閉じる）。そのため「focusin かつ target がコンテナ自身」だけを抑止すれば、空のモーダル本体クリックで
 *   閉じる既存挙動は変わらない。子孫要素への focusin は従来どおり外側扱いのまま。
 *
 * React に依存しない純粋関数（node --test で検証: pnpm test:popover-dismiss）。
 */

/** Dialog の FocusScope コンテナ（Radix が role と tabIndex=-1 を付与、shadcn が data-slot を付与）。
 * 下流が AlertDialog / Sheet 等を独自に足しても拾えるよう role も見る。 */
export const DIALOG_CONTAINER_SELECTOR =
  '[data-slot="dialog-content"], [role="dialog"], [role="alertdialog"]';

export type DialogFocusRestorationInput = {
  /** DismissableLayer の InteractOutside イベントが包む元イベントの type（"focusin" | "pointerdown"） */
  originalEventType: string;
  /** InteractOutside イベントの target（元イベントの target と同一） */
  target: unknown;
};

/** 「Dialog コンテナ自身への focusin」= FocusScope のフォーカス復帰なら true */
export function isDialogFocusRestoration({
  originalEventType,
  target,
}: DialogFocusRestorationInput): boolean {
  if (originalEventType !== "focusin") return false;
  if (!target || typeof (target as Element).matches !== "function") return false;
  // closest ではなく matches: コンテナ「自身」だけを対象にする（子孫へのフォーカスは外側扱いのまま）
  return (target as Element).matches(DIALOG_CONTAINER_SELECTOR);
}
