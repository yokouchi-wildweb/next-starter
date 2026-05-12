// src/features/core/admin/dashboard/components/parts/MetricCard.tsx

import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/_shadcn/card";
import { Flex } from "@/components/Layout/Flex";
import { Span } from "@/components/TextBlocks";
import { cn } from "@/lib/cn";

/**
 * MetricCard の装飾バリエーション。
 * 背景グラデーション・グロー・ビーム・影の組み合わせでアクセントを表現する。
 *
 * 値はそのまま Tailwind class として使われるため、ユーティリティ拡張時は
 * `tailwind.config` の safelist 等を考慮すること。
 */
export type MetricCardDecoration = {
  /** 背景グラデーション (例: "from-sky-500/25 via-sky-400/10 to-transparent") */
  gradient: string;
  /** 右側のソフトグロー (例: "bg-sky-300/40") */
  glow: string;
  /** 左上の斜めビーム (例: "bg-sky-100/40") */
  beam: string;
  /** カード外側のドロップシャドウ (例: "shadow-[0_18px_45px_-20px_rgba(...)]") */
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
 * 暗い slate ベースの上に視認性の高い数値を載せる。
 *
 * 各セクションから「タイトル」「値」「装飾セット」を渡すだけで利用可能。
 * 装飾セットは `MetricCardDecoration` 型として再利用できる。
 */
export function MetricCard({ title, value, decoration }: MetricCardProps) {
  return (
    <Card
      className={cn(
        "max-sm:gap-1 relative overflow-hidden border-0 bg-slate-700 text-slate-50",
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
      <CardHeader className="relative z-10 pb-1 sm:pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-200/90 sm:text-sm">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10 pt-0 sm:pt-1">
        <Flex direction="column" gap="sm">
          <Span className="text-slate-50 text-3xl font-semibold tracking-tight drop-shadow-[0_12px_35px_rgba(15,23,42,0.45)] sm:text-[2.5rem] lg:text-5xl">
            {value}
          </Span>
        </Flex>
      </CardContent>
    </Card>
  );
}
