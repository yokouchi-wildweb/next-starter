// src/features/core/wallet/components/CurrencyDisplay/index.tsx
"use client";

import type { ReactNode } from "react";
import { CountUp } from "@/components/Animation";
import { Span } from "@/components/TextBlocks";
import { cn } from "@/lib/cn";
import type { WalletType } from "@/config/app/currency.config";
import { getCurrencyConfig } from "@/features/core/wallet/utils/currency";
import { getCurrencyIcon } from "@/features/core/wallet/components/common/currencyIcons";

/** テキストサイズ */
const TEXT_SIZE_CONFIG = {
  xs: "xs",
  sm: "sm",
  md: "md",
  lg: "lg",
  xl: "xl",
} as const;

/** アイコンサイズ（テキストに対して小さめに調整） */
const ICON_SIZE_CONFIG = {
  xs: "size-2.5",    // 10px
  sm: "size-3",      // 12px
  md: "size-4",      // 16px
  lg: "size-5",      // 20px
  xl: "size-6",      // 24px
} as const;

type SizeKey = keyof typeof TEXT_SIZE_CONFIG;

/** アイコンと数値の間隔 */
const GAP_CONFIG = {
  none: "gap-0",     // 0px
  xs: "gap-0.5",     // 2px
  sm: "gap-1",       // 4px
  md: "gap-1.5",     // 6px
  lg: "gap-2",       // 8px
  xl: "gap-3",       // 12px
} as const;

type GapSize = keyof typeof GAP_CONFIG;

/** アイコンとテキストの垂直方向の揃え */
const ALIGN_CONFIG = {
  center: "items-center",
  baseline: "items-baseline",
  start: "items-start",
  end: "items-end",
} as const;

type AlignType = keyof typeof ALIGN_CONFIG;

/** テキストの太さ */
type WeightType = "medium" | "semiBold" | "bold";

/** 色の指定方法: "auto"=通貨設定色, "inherit"=親要素から継承, その他=任意の色文字列 */
type ColorType = "auto" | "inherit" | (string & {});

type CurrencyDisplayProps = {
  /** ウォレット種別 */
  walletType: WalletType;
  /** 表示金額 */
  amount: number;
  /** テキストサイズ */
  size?: SizeKey;
  /** アイコンサイズ（未指定時は size と同じ） */
  iconSize?: SizeKey;
  /** アイコンと数値の間隔 */
  gap?: GapSize;
  /** アイコンとテキストの垂直方向の揃え */
  align?: AlignType;
  /** アイコンを表示するか */
  showIcon?: boolean;
  /** ラベルを表示するか（例: "1,000 コイン"） */
  showLabel?: boolean;
  /** 単位を表示するか（例: "1,000 コイン" or "1,000 pt"） */
  showUnit?: boolean;
  /** 金額の前に付ける任意の内容（文字列・JSX・装飾コンポーネント可。例: "合計"） */
  prefix?: ReactNode;
  /** prefix をアイコンの前後どちらに置くか（デフォルト: "beforeIcon"） */
  prefixPosition?: "beforeIcon" | "afterIcon";
  /** 金額の後に付ける任意の内容（文字列・JSX 可。指定時は showLabel/showUnit より優先） */
  suffix?: ReactNode;
  /** 太字にするか（weight未指定時のみ有効） */
  bold?: boolean;
  /** テキストの太さ（bold より優先） */
  weight?: WeightType;
  /** 色の指定: "auto"=通貨設定色(デフォルト), "inherit"=親要素から継承, 文字列=任意の色 */
  color?: ColorType;
  /** ルート要素に追加するクラス名 */
  className?: string;
  /** カウントアップアニメーションを有効にするか */
  animate?: boolean;
  /** アニメーション時間（秒） */
  animationDuration?: number;
  /** 値変更時に前の値から開始するか */
  preserveValue?: boolean;
};

/**
 * 通貨表示コンポーネント
 * 各通貨の色・アイコンを統一フォーマットで表示
 */
export function CurrencyDisplay({
  walletType,
  amount,
  size = "md",
  iconSize,
  gap = "md",
  align = "center",
  showIcon = true,
  showLabel = false,
  showUnit = false,
  prefix,
  prefixPosition = "beforeIcon",
  suffix,
  bold = false,
  weight,
  color = "auto",
  className,
  animate = false,
  animationDuration = 2,
  preserveValue = true,
}: CurrencyDisplayProps) {
  const config = getCurrencyConfig(walletType);
  const Icon = getCurrencyIcon(walletType);
  const textSizeClass = TEXT_SIZE_CONFIG[size];
  const iconSizeClass = ICON_SIZE_CONFIG[iconSize ?? size];
  const gapClass = GAP_CONFIG[gap];
  const alignClass = ALIGN_CONFIG[align];

  // weight が指定されていれば優先、なければ bold フラグで判定
  const resolvedWeight: WeightType = weight ?? (bold ? "bold" : "medium");

  // 色の解決: "auto"=通貨設定色, "inherit"=スタイル付与なし, その他=指定値
  const colorStyle =
    color === "inherit" ? undefined : { color: color === "auto" ? config.color : color };

  // サフィックスの決定: suffix prop > showLabel > showUnit の優先度
  const resolvedSuffix = suffix ?? (showLabel ? config.label : showUnit ? config.unit : "");

  // prefix 要素（位置のみアイコン前後で切り替えるため一度だけ定義）
  const prefixNode = prefix ? (
    <Span
      data-currency-display="prefix"
      size={textSizeClass}
      weight={resolvedWeight}
      style={colorStyle}
    >
      {prefix}
    </Span>
  ) : null;

  return (
    <span
      data-currency-display="root"
      // align-middle: inline-flex のベースラインは先頭アイテム(SVGアイコン)の下端になり、
      // baseline 揃えだと周囲テキストより上に飛び出すため、行内では中央揃えで配置する
      className={cn("inline-flex align-middle", gapClass, alignClass, className)}
    >
      {prefixPosition === "beforeIcon" && prefixNode}
      {showIcon && (
        <Icon
          data-currency-display="icon"
          className={iconSizeClass}
          style={colorStyle}
        />
      )}
      {prefixPosition === "afterIcon" && prefixNode}
      <Span
        data-currency-display="amount"
        size={textSizeClass}
        weight={resolvedWeight}
        style={colorStyle}
      >
        {animate ? (
          <CountUp
            end={amount}
            duration={animationDuration}
            preserveValue={preserveValue}
            separator=","
          />
        ) : (
          amount.toLocaleString()
        )}
        {resolvedSuffix !== "" && resolvedSuffix != null && (
          <span data-currency-display="suffix">
            {" "}
            {resolvedSuffix}
          </span>
        )}
      </Span>
    </span>
  );
}
