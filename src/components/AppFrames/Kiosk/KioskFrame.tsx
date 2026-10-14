// src/components/AppFrames/Kiosk/KioskFrame.tsx

"use client";

import type { ComponentPropsWithoutRef } from "react";

import { useWakeLock } from "@/hooks/useWakeLock";
import { cn } from "@/lib/cn";

export type KioskFrameProps = ComponentPropsWithoutRef<"div"> & {
  /**
   * env(safe-area-inset-*) ぶんのパディングを付与する
   * （ノッチ・ホームインジケータ・丸角ディスプレイの回避）。既定 false。
   */
  safeArea?: boolean;
  /**
   * 表示中は Screen Wake Lock で画面スリープを抑止する（useWakeLock）。既定 false。
   * 卓上端末・サイネージなど常時点灯が前提の画面で true にする。
   * 非対応ブラウザは no-op。
   */
  wakeLock?: boolean;
};

/**
 * UserLayout / AdminLayout の外側（独立ルート群）で使う、ビューポート固定・
 * 非スクロールのページ枠。卓上タブレット端末、サイネージ、チェックイン端末など
 * 「どの解像度・比率でも 1 画面に収まり、絶対にスクロールしない」画面の土台。
 *
 * - 高さは `--viewport-height`（ViewportHeightWatcher が root layout で更新する
 *   実寸）に固定し、フォールバックは 100dvh。min-h ではなく h なので中身に
 *   押し広げられず、body はスクロールしない
 * - overflow-clip（scroll container 化しないので focus 駆動の勝手なスクロールも
 *   起きない）+ overscroll-none（タブレットの引っ張り更新・バウンスを抑止）
 * - flex-col。子は `flex-1 min-h-0` だけで残り高さを得る
 *   （UserPage fill / AdminPage fill と同じ子契約。calc() やマジックナンバー不要）
 * - ヘッダー・フッター・認証・Provider は一切持たない。bg-background text-foreground
 *   だけ既定で当てる（className で上書き可）
 *
 * UserPage fill との違い: fill は UserLayout の外枠が :has() で確定高さに切り替わり
 * 「ヘッダー下の残り高さ」を占有するフロー内の部品。KioskFrame は自身がビューポート根。
 * レイアウトを持つ画面では UserPage fill / immersive を、持たない独立ルート群では
 * KioskFrame を使う。
 *
 * 全画面化ボタンは画面デザインの一部なので内蔵しない。useFullscreen を使った
 * レシピは同階層の README を参照。
 *
 * ```tsx
 * // src/app/terminal/layout.tsx
 * export default function TerminalLayout({ children }) {
 *   return <KioskFrame wakeLock>{children}</KioskFrame>;
 * }
 * ```
 */
export function KioskFrame({
  safeArea = false,
  wakeLock = false,
  className,
  children,
  ...props
}: KioskFrameProps) {
  useWakeLock(wakeLock);

  return (
    <div
      data-component="KioskFrame"
      data-kiosk-frame=""
      {...props}
      className={cn(
        "flex h-[var(--viewport-height,100dvh)] w-full flex-col overflow-clip overscroll-none bg-background text-foreground",
        safeArea &&
          "pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
