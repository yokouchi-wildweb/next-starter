// src/components/Form/Input/Manual/AsyncOptionSource/popoverSide.ts
//
// ピッカー系ポップオーバー（AsyncMultiSelectInput / AsyncComboboxInput / MultiSelectInput / ComboboxInput）の
// 「開く向き」と「中身の高さ上限」の共通部品。
//
// なぜ Radix の flip に任せないか:
//  PopoverContent は配置側のビューポート残り高さ（--radix-popover-content-available-height）を
//  max-height にしている（確定ボタンを画面外に出さないため）。floating-ui の flip は
//  「描画済みの要素の大きさ」で溢れを判定するので、開いた直後に中身が短い（読み込み中など）と
//  下に配置 → 上限 = 下の残り高さ → 後から候補が届いても上限で縮められて溢れない → 下のまま、になる。
//  そこで開く瞬間にトリガーの上下の空きを測り、必要な高さに足りなければ上へ開く。flip は保険として残る。

export type PopoverVerticalSide = "top" | "bottom";

/** sideOffset(4) + collisionPadding(8)（PopoverContent の既定）。トリガーと画面端の間で使えない高さ */
export const POPOVER_SIDE_MARGIN = 12;

export type DecidePopoverSideInput = {
  /** トリガーの上端（viewport 座標） */
  anchorTop: number;
  /** トリガーの下端（viewport 座標） */
  anchorBottom: number;
  /** ビューポートの高さ */
  viewportHeight: number;
  /** 中身を縮めずに出したい高さ */
  preferredHeight: number;
  /** トリガーと画面端の間で使えない高さ（既定: POPOVER_SIDE_MARGIN） */
  margin?: number;
};

/** 下の空きが preferredHeight に足りず、かつ上の空きの方が大きいときだけ "top"。それ以外は "bottom" */
export function decidePopoverSide({
  anchorTop,
  anchorBottom,
  viewportHeight,
  preferredHeight,
  margin = POPOVER_SIDE_MARGIN,
}: DecidePopoverSideInput): PopoverVerticalSide {
  const below = viewportHeight - anchorBottom - margin;
  const above = anchorTop - margin;
  return below < preferredHeight && above > below ? "top" : "bottom";
}

/**
 * ピッカーの中身（PopoverContent 直下のルート要素）に付ける高さ上限。
 * PopoverContent と同じ上限から枠線 2px（border 上下）を引いた値にし、中身の flex-col チェーン
 * （min-h-0）で候補リストだけを縮める。これで外側の popover-scroll が溢れず、スクロール領域は
 * 候補リストの 1 つだけになる（タブ・検索欄・確定ボタンは常に見える）。
 * PopoverContent の枠線幅を変えるときはここも合わせる。
 */
export const PICKER_POPOVER_BODY_CLASS =
  "min-h-0 max-h-[calc(var(--radix-popover-content-available-height)-2px)]";
