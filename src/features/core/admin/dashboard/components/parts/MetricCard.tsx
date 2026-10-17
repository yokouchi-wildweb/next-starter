// src/features/core/admin/dashboard/components/parts/MetricCard.tsx

import type { ReactNode } from "react";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Span } from "@/components/TextBlocks";
import { cn } from "@/lib/cn";

/**
 * MetricCard の装飾バリエーション。
 * 背景グラデーション・グロー・ビーム・影の組み合わせでアクセントを表現する。
 *
 * 値はそのまま Tailwind class として使われるため、テーマトークン(secondary / chart-* 等)で書く
 * (生パレット色は ESLint style-tokens/no-raw-palette で検出される)。
 */
export type MetricCardDecoration = {
  /** 背景グラデーション (例: "from-secondary/25 via-secondary/10 to-transparent") */
  gradient: string;
  /** 右側のソフトグロー (例: "bg-secondary/40") */
  glow: string;
  /** 左上の斜めビーム (例: "bg-secondary/20") */
  beam: string;
  /** カード外側のドロップシャドウ (例: "shadow-[0_18px_45px_-20px_color-mix(in_oklch,_var(--color-secondary)_55%,_transparent)]") */
  shadow: string;
};

type MetricCardProps = {
  title: ReactNode;
  value: ReactNode;
  decoration: MetricCardDecoration;
};

/**
 * メトリクス1件を表示する装飾カード。
 *
 * グラデーション背景・グロー・ビームの3層を `pointer-events-none` の overlay として重ね、
 * primary 色のベース(既定では暗色)の上に視認性の高い数値を載せる。
 *
 * 各セクションから「タイトル」「値」「装飾セット」を渡すだけで利用可能。
 * 装飾セットは `MetricCardDecoration` 型として再利用できる。
 */
export function MetricCard({ title, value, decoration }: MetricCardProps) {
  return (
    <Block
      className={cn(
        "relative flex flex-col gap-6 overflow-hidden rounded-xl bg-primary py-6 text-primary-foreground max-sm:gap-1",
        decoration.shadow,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
          decoration.gradient,
        )}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-16 top-1/2 h-52 w-52 -translate-y-1/2 rounded-full blur-3xl",
          decoration.glow,
        )}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -left-20 top-0 h-32 w-40 -translate-y-1/3 rotate-12 blur-2xl",
          decoration.beam,
        )}
      />
      <Block className="relative z-10 px-6 pb-1 sm:pb-2">
        <Span className="text-xs font-semibold uppercase leading-none tracking-[0.2em] text-primary-foreground/90 sm:text-sm">
          {title}
        </Span>
      </Block>
      <Block className="relative z-10 px-6 pt-0 sm:pt-1">
        <Flex direction="column" gap="sm">
          <Span className="text-primary-foreground text-3xl font-semibold tracking-tight drop-shadow-[0_12px_35px_color-mix(in_oklch,_var(--color-overlay)_45%,_transparent)] sm:text-[2.5rem] lg:text-5xl">
            {value}
          </Span>
        </Flex>
      </Block>
    </Block>
  );
}
