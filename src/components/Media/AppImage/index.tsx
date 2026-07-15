// src/components/Media/AppImage/index.tsx
"use client";

import NextImage from "next/image";
import { useState } from "react";

import { cn } from "@/lib/cn";

import { isOptimizableSrc } from "./optimizable";
import { resolveSizes, type AppImageSizesPreset } from "./sizes";

type CommonProps = {
  /** 画像 URL。空(undefined/null/"")なら fallbackSrc、それも無ければ画像なしで描画 */
  src: string | null | undefined;
  alt: string;
  /** 読み込み失敗・src 欠損時に表示する代替画像 */
  fallbackSrc?: string;
  /** LCP 画像(ファーストビューの主役画像)にのみ付与。lazy-loading を無効化し先読みする */
  priority?: boolean;
  /**
   * 最適化の明示制御。省略時は src から自動判定
   * (ローカルパス・自バケットの Firebase Storage URL のみ最適化を通し、
   *  それ以外は per-image unoptimized にしてクラッシュを防ぐ)。
   * remotePatterns に独自ホストを追加したフォークは false の明示で自動判定を上書きできる
   */
  unoptimized?: boolean;
};

type FillProps = CommonProps & {
  /** fill: 親に実寸不要。このコンポーネント自身が position:relative の箱を描画する(デフォルト) */
  mode?: "fill";
  /**
   * 表示幅ヒント(必須)。プリセット名("thumb" | "card" | "hero" | "full")か生の sizes 文字列。
   * 忘れると全幅相当の画像が選ばれ最適化が無駄になるため、型レベルで必須にしている
   */
  sizes: AppImageSizesPreset | (string & {});
  /** 箱に対する画像の収め方。既定は cover(はみ出しトリミング) */
  objectFit?: "cover" | "contain";
  /** コンテナ(箱)側のクラス。aspect-[...] や角丸・背景色はここに指定する */
  className?: string;
  /** 画像要素側のクラス(object-position の調整等) */
  imageClassName?: string;
};

type IntrinsicProps = CommonProps & {
  /** intrinsic: ロゴ・アイコン等、実寸が既知のアセット用 */
  mode: "intrinsic";
  width: number;
  height: number;
  /** intrinsic では画像の実寸がそのまま上限になるため任意 */
  sizes?: string;
  className?: string;
};

export type AppImageProps = FillProps | IntrinsicProps;

/**
 * next/image の共通ラッパー
 *
 * ## 用途
 * - 生の <img> および next/image 直接使用の代わりに使用(CLAUDE.md「wrappers」)
 * - fill の親要素規約・sizes 指定・エラーフォールバック・未登録ホストのクラッシュガードを内蔵
 *
 * ## モードの使い分け
 * - fill(デフォルト): ユーザーアップロード画像など実寸不明のコンテンツ。
 *   呼び出し側は className で縦横比の箱(例: aspect-[1.618/1])を渡すだけでよい
 * - intrinsic: ロゴ・アイコンなど実寸が分かっている静的アセット。width/height を渡す
 *
 * ## IMAGE_OPTIMIZATION との関係
 * - フラグ OFF でも lazy-loading と layout-shift 防止は効くため、タグ移行を先行してよい
 * - フラグ ON にすると、このコンポーネント経由の画像だけがリサイズ/WebP 配信に切り替わる
 */
export function AppImage(props: AppImageProps) {
  const { src, alt, fallbackSrc, priority, unoptimized } = props;

  // onError で fallback へ切り替える。失敗した src を覚える方式なので、
  // src プロップが変われば自動的にリトライ状態へ戻る(useEffect でのリセット不要)
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const errored = src != null && src === failedSrc;
  const displaySrc = (!src || errored ? fallbackSrc : src) || undefined;

  const resolvedUnoptimized = displaySrc ? (unoptimized ?? !isOptimizableSrc(displaySrc)) : undefined;

  const handleError = () => {
    if (src && !errored) setFailedSrc(src);
  };

  if (props.mode === "intrinsic") {
    if (!displaySrc) return null;
    return (
      <NextImage
        data-component="AppImage"
        src={displaySrc}
        alt={alt}
        width={props.width}
        height={props.height}
        sizes={props.sizes}
        priority={priority}
        unoptimized={resolvedUnoptimized}
        className={props.className}
        onError={handleError}
      />
    );
  }

  // fill: 自前で position:relative の箱を描画するため、親要素側の規約(positioned parent)が不要。
  // overflow-clip は hidden と違い scroll container にならず、focus 駆動の意図しないスクロールを防ぐ
  return (
    <div data-component="AppImage" className={cn("relative overflow-clip", props.className)}>
      {displaySrc ? (
        <NextImage
          src={displaySrc}
          alt={alt}
          fill
          sizes={resolveSizes(props.sizes)}
          priority={priority}
          unoptimized={resolvedUnoptimized}
          className={cn(props.objectFit === "contain" ? "object-contain" : "object-cover", props.imageClassName)}
          onError={handleError}
        />
      ) : null}
    </div>
  );
}
