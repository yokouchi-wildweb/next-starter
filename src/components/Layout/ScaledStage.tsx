// src/components/Layout/ScaledStage.tsx

"use client";

import { useRef, type ReactNode } from "react";

import { useFitScale, type FitScaleMode } from "@/hooks/useFitScale";
import { cn } from "@/lib/cn";

export type ScaledStageProps = {
  /** 論理キャンバスの幅 (px)。子はこの座標系で固定 px レイアウトを書く */
  logicalWidth: number;
  /** 論理キャンバスの高さ (px) */
  logicalHeight: number;
  /** 既定: contain（幅・高さ両方が収まる = レターボックス） */
  fit?: FitScaleMode;
  /** これ以下には縮めない（既定 0）。下回る場合は overflow の指定に従う */
  minScale?: number;
  /** これ以上には拡大しない（既定 Infinity） */
  maxScale?: number;
  /**
   * 余白が出た時のステージ配置。既定 center。
   * center は m-auto による「安全な中央寄せ」なので、minScale でコンテナを
   * はみ出しても先頭側が切れない。
   */
  align?: "center" | "start";
  /**
   * minScale で収まり切らない時の扱い。既定 clip（キオスク = 絶対にスクロールさせない）。
   * ページ内キャンバスで横スクロールに逃がしたい場合は auto。
   */
  overflow?: "clip" | "auto";
  /**
   * 初回計測が済むまでステージを visibility:hidden にして、倍率 1 → 実倍率への
   * 跳びを隠す（既定 true）。
   */
  hideUntilMeasured?: boolean;
  /** 計測コンテナ（外枠）のクラス */
  className?: string;
  /** 論理ステージ（transform が掛かる要素）のクラス。背景色・角丸など */
  stageClassName?: string;
  children: ReactNode;
};

/**
 * 固定の論理 W×H で組んだ DOM を、コンテナに収まるよう transform:scale で拡縮する
 * レイアウト部品。子は「1280×800 のデザインカンプ通りの px 値」で書けばよく、
 * 解像度・比率の違いは倍率だけで吸収される（サイネージ・キオスク画面・固定比率の
 * ゲーム盤面など、流体レイアウトより「カンプ忠実」が優先される画面向け）。
 *
 * 構造: 計測コンテナ（ref、flex-1 min-h-0 で親の残り領域を占有）
 *       → 拡縮後サイズの枠（width×scale, height×scale。レイアウト上の実占有面積）
 *         → 論理ステージ（logicalWidth×logicalHeight、transform-origin 0 0 で scale）
 * 枠を挟む理由: transform は layout box を変えないため、ステージ単体を flex で
 * 中央寄せすると「論理サイズのまま」の箱として配置されてしまう。
 *
 * 親が flex-col の fill 系土台（KioskFrame / UserPage fill / AdminPage fill）なら
 * そのまま残り高さを占有する。親が確定高さの通常ブロックなら className="h-full" を渡す。
 *
 * ```tsx
 * <KioskFrame>
 *   <ScaledStage logicalWidth={1280} logicalHeight={800}>
 *     <Block className="h-[800px] w-[1280px] p-12">...カンプ通りの px レイアウト...</Block>
 *   </ScaledStage>
 * </KioskFrame>
 * ```
 */
export function ScaledStage({
  logicalWidth,
  logicalHeight,
  fit = "contain",
  minScale,
  maxScale,
  align = "center",
  overflow = "clip",
  hideUntilMeasured = true,
  className,
  stageClassName,
  children,
}: ScaledStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scale, width, height, isMeasured } = useFitScale(containerRef, {
    logicalWidth,
    logicalHeight,
    fit,
    minScale,
    maxScale,
  });

  return (
    <div
      ref={containerRef}
      data-component="ScaledStage"
      className={cn(
        "relative flex min-h-0 min-w-0 w-full flex-1",
        overflow === "clip" ? "overflow-clip" : "overflow-auto",
        className,
      )}
    >
      <div
        data-component="ScaledStage:frame"
        className={cn("relative shrink-0", align === "center" && "m-auto", hideUntilMeasured && !isMeasured && "invisible")}
        style={{ width, height }}
      >
        <div
          data-component="ScaledStage:stage"
          className={cn("absolute top-0 left-0", stageClassName)}
          style={{
            width: logicalWidth,
            height: logicalHeight,
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
