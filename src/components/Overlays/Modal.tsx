// src/components/Overlays/Modal.tsx

"use client";

import { type CSSProperties, ReactNode, useState } from "react";
import {
  DialogPrimitives,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FALLBACK_DIALOG_TITLE,
} from "@/components/Overlays/DialogPrimitives";
import Dialog from "@/components/Overlays/Dialog";
import { cn } from "@/lib/cn";

/** 閉じ確認ガードの設定。この API は文言差し替え（title/message/ラベル2点）までで凍結し、
 * variant 変更・任意 JSX・確認 UI の差し替えは追加しない方針。
 * それ以上のカスタムは consumer 側の onOpenChange ガードで実現する（Overlays/README.md のレシピ参照）。 */
export type ModalConfirmOnClose = {
  /** true のとき、閉じ操作（✕ ボタン / ESC / 背景クリック）を確認ダイアログで遮る。
   * 未保存の変更がある間だけ true にする使い方を想定。 */
  enabled: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  titleSrOnly?: boolean;
  headerContent?: ReactNode;
  children?: ReactNode;
  /** スクロール領域の外側に描画される常時表示フッター（確定/キャンセル等のアクションバー）。
   * 区切り線・余白・背景は Modal 側が持つため、コンシューマはボタン列だけを渡せばよい。
   * scrollable / 非 scrollable どちらのモードでも本体スクロールに追従せず常に表示される。 */
  footer?: ReactNode;
  /** 未保存変更の破棄防止ガード。enabled が true の間、ユーザー操作による閉じ
   * （✕ / ESC / 背景クリック → onOpenChange(false)）を確認ダイアログで遮り、
   * 承諾されたときだけ onOpenChange(false) を呼ぶ。
   * 親が open を直接 false にするプログラム的クローズ（保存完了後など）は遮らない。 */
  confirmOnClose?: ModalConfirmOnClose;
  showCloseButton?: boolean;
  className?: string;
  maxWidth?: number | string;
  minHeight?: number | string;
  /** 最大高さ。指定すると本体が overflow-y-auto でラップされる。
   * デフォルトは箱（DialogContent）の上限と同じ「ビューポート - 上下 1rem 余白」。
   * DEFAULT_MAX_HEIGHT を超える値は内部で min() クランプされる。
   * 本体の高さは箱の上限 + flex 縮小で必ず箱内に収まるため、ヘッダ/タブ/footer の
   * 実高に応じた予算を consumer が計算する必要はない。
   * `null` を渡すとクランプごと制限を解除できる。 */
  maxHeight?: number | string | null;
  height?: number | string;
  /** 本体ラッパーをスクロールコンテナにするか。デフォルト true（従来挙動: overflow-y-auto）。
   * false = 固定高コンテナモード: ラッパーが overflow-clip になり本体はスクロールせず、
   * consumer が用意した内側領域（タブ内のテーブル等）だけをスクロールさせる。
   * このとき height 未指定なら maxHeight（クランプ後）を height に自動補完するため、
   * 箱の高さが確定し子要素は h-full / flex-1 で内部レイアウトを組める。
   * 既定 maxHeight が生きている場合、false 指定だけで常にビューポートいっぱいの固定高になる点に注意。
   * maxHeight: null と併用するとラッパー自体が描画されず高さ管理は consumer に委ねられる。
   * overflow-hidden でなく clip なのは、hidden は scroll container として残り
   * 内部の focus 駆動 scrollIntoView で隠れスクロールが発火するため。 */
  scrollable?: boolean;
  onCloseAutoFocus?: (event: Event) => void;
};

/** DialogContent（モーダルの箱全体）の最大高さ。高さ制御の唯一の真のソース。
 * 箱は flex-col で、ヘッダ/footer は shrink-0、本体ラッパーは min-h-0 の flex 子。
 * 箱がこの上限に達すると本体ラッパーだけが縮んでスクロールするため、ヘッダ・タブ・footer の
 * 実高がいくらであっても close ボタンや footer が箱外・画面外に押し出されることは構造的に起きない。
 * （旧実装は grid だったため auto 行が箱の max-height で縮まず、本体に別途「クローム予算」を
 * 持たせていた。予算は実クロームと一致せず TabbedModal + footer ではみ出していた） */
const CONTENT_MAX_HEIGHT = "calc(100dvh - 2rem)";
const CONTENT_MAX_HEIGHT_CLASS = "max-h-[calc(100dvh-2rem)]";

/** Modal 本体ラッパーの既定 maxHeight。箱の上限と同値。
 * 役割は「既定で本体ラッパーを描画してスクロール領域にする」ことであり、クローム予算ではない
 * （実際の収まりは箱の上限 + flex 縮小が担保する）。
 * maxHeight / height にこれを超える値が渡された場合は min() でこの値にクランプされる。 */
const DEFAULT_MAX_HEIGHT = CONTENT_MAX_HEIGHT;

/** confirmOnClose の既定文言 */
const DEFAULT_CONFIRM_ON_CLOSE_MESSAGE =
  "編集中の内容が保存されていません。閉じてもよろしいですか？";
const DEFAULT_CONFIRM_ON_CLOSE_CONFIRM_LABEL = "閉じる";
const DEFAULT_CONFIRM_ON_CLOSE_CANCEL_LABEL = "キャンセル";

export default function Modal({
  open,
  onOpenChange,
  title,
  titleSrOnly,
  headerContent,
  children,
  footer,
  confirmOnClose,
  showCloseButton = true,
  className,
  maxWidth = 640,
  minHeight,
  maxHeight = DEFAULT_MAX_HEIGHT,
  height,
  scrollable = true,
  onCloseAutoFocus,
}: ModalProps) {
  // 閉じ確認ダイアログの表示状態（confirmOnClose 用）
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  // 確認表示中に親がプログラム的に閉じた場合、確認ダイアログが取り残されて
  // 次回オープン直後に「未保存」確認が出てしまうため、open の解除に同期して畳む
  // （render 中に前回値と比較して state を調整する React 推奨パターン。effect だと1フレーム遅れる）
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) setCloseConfirmOpen(false);
  }
  // ユーザー操作による閉じ（✕ / ESC / 背景クリック）を一点で遮る。
  // Modal は controlled なので、Radix 起点の閉じ要求はすべてここを通る
  const handleOpenChange = (next: boolean) => {
    if (!next && confirmOnClose?.enabled) {
      setCloseConfirmOpen(true);
      return;
    }
    onOpenChange(next);
  };

  // null が明示的に渡された場合は制限とクランプを解除（後方互換用）
  const effectiveMaxHeight = maxHeight ?? undefined;
  const clampEnabled = maxHeight !== null;
  const toCssSize = (value: number | string) =>
    typeof value === "number" ? `${value}px` : value;
  // DEFAULT_MAX_HEIGHT（= 箱の上限）を超える指定値をクランプ。既定値以下の指定はそのまま効く
  const clampToViewport = (value: string) =>
    clampEnabled && value !== DEFAULT_MAX_HEIGHT ? `min(${value}, ${DEFAULT_MAX_HEIGHT})` : value;

  const resolvedScrollableMinHeight =
    minHeight !== undefined ? toCssSize(minHeight) : undefined;
  const resolvedScrollableMaxHeight =
    effectiveMaxHeight !== undefined ? clampToViewport(toCssSize(effectiveMaxHeight)) : undefined;
  const clampedHeight =
    height !== undefined ? clampToViewport(toCssSize(height)) : undefined;
  // 固定高コンテナモード（scrollable=false）で height 未指定なら maxHeight を height に補完し、
  // 箱の高さを確定させて子の h-full / flex-1 を機能させる。
  // minHeight は height の下限として max() に畳み込む（ラッパーに min-height を直接付けると
  // flex 縮小がそこで止まり、低いビューポートで箱外にはみ出すため。height は flex 子として縮める）
  const fixedModeBaseHeight = clampedHeight ?? resolvedScrollableMaxHeight;
  const resolvedScrollableHeight = !scrollable
    ? fixedModeBaseHeight !== undefined && resolvedScrollableMinHeight !== undefined
      ? `max(${resolvedScrollableMinHeight}, ${fixedModeBaseHeight})`
      : fixedModeBaseHeight
    : clampedHeight;
  const shouldWrapScrollable = Boolean(
    resolvedScrollableMinHeight || resolvedScrollableMaxHeight || resolvedScrollableHeight,
  );
  // minHeight の置き場（scrollable モード）: ラッパーではなく内側の div に付ける。
  // ラッパー自身に min-height を付けると flex 縮小がそこで止まり、箱の上限を超えて本体が
  // 箱外にはみ出す。内側に付ければ「短い内容でも高さが揺れない」は保ちつつ、箱が足りない時は
  // ラッパーが縮んで内側がスクロールする。
  // 固定高モードでは height に畳み込み済みなので内側 div は挟まない（子の h-full を壊さない）。
  const minHeightOnInner = scrollable ? resolvedScrollableMinHeight : undefined;
  // 固定高モードで height の元が無い（maxHeight: null + minHeight のみ）場合だけ従来通りラッパーに付ける
  const minHeightOnWrapper =
    !scrollable && fixedModeBaseHeight === undefined ? resolvedScrollableMinHeight : undefined;
  const scrollableStyle: CSSProperties | undefined = shouldWrapScrollable
    ? {
        ...(minHeightOnWrapper ? { minHeight: minHeightOnWrapper } : {}),
        ...(resolvedScrollableMaxHeight ? { maxHeight: resolvedScrollableMaxHeight } : {}),
        ...(resolvedScrollableHeight ? { height: resolvedScrollableHeight } : {}),
      }
    : undefined;

  // title 省略時も role="dialog" にアクセシブルネームを必ず与える（Radix の要件でもある）
  const resolvedTitle = title || FALLBACK_DIALOG_TITLE;
  const resolvedTitleSrOnly = title ? Boolean(titleSrOnly) : true;

  return (
    <>
      <DialogPrimitives open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={showCloseButton}
          // grid → flex-col: 箱の max-h に対して本体ラッパー（min-h-0）だけが縮む構造にする
          className={cn("flex flex-col", clampEnabled && CONTENT_MAX_HEIGHT_CLASS, className)}
          maxWidth={maxWidth}
          onCloseAutoFocus={onCloseAutoFocus}
          // Modal は description を持たない。未指定を明示しないと Radix が警告を出す
          aria-describedby={undefined}
        >
          {resolvedTitleSrOnly && !headerContent ? (
            <DialogTitle srOnly>{resolvedTitle}</DialogTitle>
          ) : (
            <DialogHeader className="shrink-0">
              <DialogTitle srOnly={resolvedTitleSrOnly}>{resolvedTitle}</DialogTitle>
              {headerContent}
            </DialogHeader>
          )}
          {shouldWrapScrollable ? (
            <div
              className={cn("min-h-0", scrollable ? "overflow-y-auto" : "overflow-clip")}
              style={scrollableStyle}
            >
              {minHeightOnInner ? (
                <div style={{ minHeight: minHeightOnInner }}>{children}</div>
              ) : (
                children
              )}
            </div>
          ) : (
            children
          )}
          {footer != null ? (
            <DialogFooter className="shrink-0 border-t pt-4">{footer}</DialogFooter>
          ) : null}
        </DialogContent>
      </DialogPrimitives>
      {confirmOnClose ? (
        <Dialog
          open={closeConfirmOpen}
          onOpenChange={setCloseConfirmOpen}
          title={confirmOnClose.title}
          description={confirmOnClose.message ?? DEFAULT_CONFIRM_ON_CLOSE_MESSAGE}
          layer="alert"
          overlayLayer="alert"
          confirmLabel={confirmOnClose.confirmLabel ?? DEFAULT_CONFIRM_ON_CLOSE_CONFIRM_LABEL}
          cancelLabel={confirmOnClose.cancelLabel ?? DEFAULT_CONFIRM_ON_CLOSE_CANCEL_LABEL}
          confirmVariant="destructive"
          onConfirm={() => {
            setCloseConfirmOpen(false);
            onOpenChange(false);
          }}
        />
      ) : null}
    </>
  );
}
