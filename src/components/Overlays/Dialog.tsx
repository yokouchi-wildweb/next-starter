// src/components/Overlays/Dialog.tsx

"use client";

import { ReactNode, useState, useCallback, useRef } from "react";
import {
  DialogPrimitives,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  FALLBACK_DIALOG_TITLE,
  type DialogContentLayer,
  type DialogOverlayLayer,
} from "@/components/Primitives/Dialog";
import { Button } from "@/components/Form/Button/Button";
import { type ButtonStyleProps } from "@/components/Form/Button/button-variants";
import { cn } from "@/lib/cn";

export type TextVariant = "default" | "primary" | "secondary" | "accent" | "sr-only";
export type TextAlign = "left" | "center" | "right";

const TEXT_VARIANT_CLASS: Record<TextVariant, string> = {
  default: "text-foreground",
  primary: "text-primary",
  secondary: "text-secondary",
  accent: "text-accent",
  "sr-only": "sr-only",
};

const TEXT_ALIGN_CLASS: Record<TextAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/** 取り消しと確定の間に置く 3 つ目のボタン(例: 「留まる / 離れる / 保存して離れる」の「離れる」)。
 * 押すと onClick だけを呼ぶ(閉じるかは呼び手が onOpenChange で決める)。
 * Promise を返す間は確定と同じく 3 つのボタンが止まり、このボタンだけ「処理中...」になる */
export type DialogExtraAction = {
  label: string;
  onClick: () => void | Promise<void>;
  /** @default "outline" */
  variant?: ButtonStyleProps["variant"];
  disabled?: boolean;
};

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  titleVariant?: TextVariant;
  titleAlign?: TextAlign;
  /**
   * 説明文。DialogDescription（<p>タグ）でラップされ、aria-describedby の対象になる。
   * children と併用可（ヘッダ内で title の直下に描画され、children はその下の本体に入る）。
   */
  description?: ReactNode;
  descriptionVariant?: TextVariant;
  descriptionAlign?: TextAlign;
  /**
   * 複雑なコンテンツ用。そのまま本体（スクロール領域）に出力されるため、ブロック要素も使用可能。
   */
  children?: ReactNode;
  /**
   * 右上の ✕ ボタンを表示するか。
   * @default false（確認ダイアログはフッターのボタンで閉じるのが基本）
   * showCancelButton / showConfirmButton を両方 false にする場合は true にして、
   * 目に見える閉じ手段を必ず残すこと。
   */
  showCloseButton?: boolean;
  /**
   * ダイアログのz-indexレイヤー。
   * 浮く物は全部 floating(後に開いた物が上、当議会 D189)。モーダルの上の確認ダイアログも floating のまま上に出る。
   * @default "floating"
   */
  layer?: DialogContentLayer;
  /**
   * オーバーレイ（背景）のz-indexレイヤー。
   * @default "floating"
   */
  overlayLayer?: DialogOverlayLayer;
  footerAlign?: TextAlign;
  showCancelButton?: boolean;
  showConfirmButton?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void | Promise<void>;
  confirmDisabled?: boolean;
  confirmVariant?: ButtonStyleProps["variant"];
  cancelVariant?: ButtonStyleProps["variant"];
  /** 開いた直後の自動フォーカス制御（Radix の onOpenAutoFocus をそのまま透過）。
   * 未指定時は Radix 既定（最初のフォーカス可能要素へフォーカス）。
   * preventDefault() で抑止する場合は代替フォーカスを推奨（Overlays/README.md のレシピ参照）。 */
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
  /** 本体（箱）に足すクラス */
  className?: string;
  /** 背景（覆い）に足すクラス（色・ぼかし等） */
  overlayClassName?: string;
  /** 全画面（Modal の fullscreen と同じ: 角丸・枠・最大幅・内側の余白なし、上下は safe-area の分だけ） */
  fullscreen?: boolean;
  /** portal の先の要素（省略 = body）。渡すと背景と本体はその要素の中で absolute に重なる */
  container?: HTMLElement | null;
  /** 取り消しと確定の間に置く 3 つ目のボタン */
  extraAction?: DialogExtraAction;
};

export function Dialog({
  open,
  onOpenChange,
  title,
  titleVariant = "default",
  titleAlign = "left",
  description,
  descriptionVariant = "default",
  descriptionAlign = "left",
  children,
  showCloseButton = false,
  layer,
  overlayLayer,
  footerAlign = "right",
  showCancelButton = true,
  showConfirmButton = true,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  confirmDisabled,
  confirmVariant = "primary",
  cancelVariant = "outline",
  onOpenAutoFocus,
  onCloseAutoFocus,
  className,
  overlayClassName,
  fullscreen = false,
  container,
  extraAction,
}: DialogProps) {
  // 動いている行動(確定 / 3 つ目)。どちらかの Promise の間は全部のボタンを止め、押した方だけ「処理中...」
  const [loadingAction, setLoadingAction] = useState<"confirm" | "extra" | null>(null);
  const isLoading = loadingAction !== null;
  const lockRef = useRef(false);

  const runAction = useCallback(
    async (action: (() => void | Promise<void>) | undefined, which: "confirm" | "extra") => {
      if (!action || lockRef.current) return;

      const result = action();

      // Promiseの場合はローディング状態を管理
      if (result instanceof Promise) {
        lockRef.current = true;
        setLoadingAction(which);
        try {
          await result;
        } finally {
          lockRef.current = false;
          setLoadingAction(null);
        }
      }
    },
    [],
  );

  const footerAlignClass =
    footerAlign === "left"
      ? "justify-start sm:justify-start"
      : footerAlign === "center"
        ? "justify-center sm:justify-center"
        : "justify-end sm:justify-end";

  const showFooter = showCancelButton || showConfirmButton || extraAction != null;

  return (
    <DialogPrimitives open={open} onOpenChange={onOpenChange}>
      {/* 箱の高さは Modal と同じ「ビューポート - 上下 1rem」で上限。flex-col + 本体 min-h-0 により
          長い description / children は本体だけがスクロールし、タイトルとボタン列は常に箱内に残る。
          fixed + translate 中央配置なので、上限が無いと上下両方にはみ出してスクロールで到達できない。 */}
      <DialogContent
        showCloseButton={showCloseButton}
        className={cn("flex flex-col", !fullscreen && "max-h-[calc(100dvh-2rem)]", className)}
        layer={layer}
        overlayLayer={overlayLayer}
        overlayClassName={overlayClassName}
        fullscreen={fullscreen}
        container={container}
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={onCloseAutoFocus}
        // description 未指定を明示しないと Radix が警告を出す（指定時は Radix が自動で紐付ける）
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        {title || description ? (
          <DialogHeader className="shrink-0">
            <DialogTitle
              srOnly={!title}
              className={cn(
                TEXT_VARIANT_CLASS[titleVariant],
                TEXT_ALIGN_CLASS[titleAlign],
              )}
            >
              {title || FALLBACK_DIALOG_TITLE}
            </DialogTitle>
            {description && (
              <DialogDescription
                className={cn(
                  TEXT_VARIANT_CLASS[descriptionVariant],
                  TEXT_ALIGN_CLASS[descriptionAlign],
                )}
              >
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
        ) : (
          // title 省略時も role="dialog" にアクセシブルネームを必ず与える
          <DialogTitle srOnly>{FALLBACK_DIALOG_TITLE}</DialogTitle>
        )}
        {children != null && (
          <div className="min-h-0 overflow-y-auto">{children}</div>
        )}
        {showFooter && (
          <DialogFooter className={cn("mt-4 shrink-0", footerAlignClass)}>
            {showCancelButton && (
              <Button
                size="sm"
                variant={cancelVariant}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenChange(false);
                }}
                disabled={isLoading}
              >
                {cancelLabel}
              </Button>
            )}
            {extraAction && (
              <Button
                size="sm"
                variant={extraAction.variant ?? "outline"}
                onClick={(e) => {
                  e.stopPropagation();
                  runAction(extraAction.onClick, "extra");
                }}
                disabled={extraAction.disabled || isLoading}
              >
                {loadingAction === "extra" ? "処理中..." : extraAction.label}
              </Button>
            )}
            {showConfirmButton && (
              <Button
                size="sm"
                variant={confirmVariant}
                onClick={(e) => {
                  e.stopPropagation();
                  runAction(onConfirm, "confirm");
                }}
                disabled={confirmDisabled || isLoading}
              >
                {loadingAction === "confirm" ? "処理中..." : confirmLabel}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </DialogPrimitives>
  );
}

export default Dialog;
