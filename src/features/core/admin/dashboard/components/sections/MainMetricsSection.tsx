// src/features/core/admin/dashboard/components/sections/MainMetricsSection.tsx

import { Grid } from "@/components/Layout/Grid";
import { Section } from "@/components/Layout/Section";
import SecTitle from "@/components/AppFrames/Admin/Elements/SecTitle";

import type { MainMetricsData } from "../../services/server/mainMetrics";
import type { AdminDashboardSectionProps } from "../../types";
import { MetricCard, type MetricCardDecoration } from "../parts/MetricCard";

const numberFormatter = new Intl.NumberFormat("ja-JP");

// 装飾はテーマトークンで書く(secondary / chart-2 / chart-1 はブランドのパレットに追従する)
const secondaryDecoration: MetricCardDecoration = {
  gradient: "from-secondary/40 via-secondary/15 to-transparent",
  glow: "bg-secondary/40",
  beam: "bg-secondary/20",
  shadow: "shadow-[0_18px_45px_-20px_color-mix(in_oklch,_var(--color-secondary)_55%,_transparent)]",
};

const chart2Decoration: MetricCardDecoration = {
  gradient: "from-chart-2/35 via-chart-2/10 to-transparent",
  glow: "bg-chart-2/30",
  beam: "bg-chart-2/20",
  shadow: "shadow-[0_18px_45px_-20px_color-mix(in_oklch,_var(--color-chart-2)_55%,_transparent)]",
};

const chart1Decoration: MetricCardDecoration = {
  gradient: "from-chart-1/35 via-chart-1/10 to-transparent",
  glow: "bg-chart-1/35",
  beam: "bg-chart-1/20",
  shadow: "shadow-[0_18px_45px_-20px_color-mix(in_oklch,_var(--color-chart-1)_55%,_transparent)]",
};

/**
 * サービスの稼働状況セクション。
 *
 * - ユーザー登録総数 / 本日のユーザー登録数は data で受ける(取得は services/server/mainMetrics.ts。AdminHome の loader が実行)
 * - サンプル指標2つはダミー値 (テンプレート用)
 *
 * 機能フラグ `APP_FEATURES.adminConsole.dashboard.showMainMetrics` が無効なら取得側が null を返し、何も描画しない
 * (registry から外したのと同等の見た目になる)。
 */
export function MainMetricsSection({ data }: AdminDashboardSectionProps<MainMetricsData | null>) {
  if (!data) {
    return null;
  }

  const { totalUserCount, todayUserCount } = data;

  return (
    <Section id="main-metrics">
      <SecTitle>サービスの稼働状況</SecTitle>

      <Grid columns="two" gap="md" className="sm:gap-6 lg:grid-cols-4">
        <MetricCard
          title="ユーザー登録総数"
          value={numberFormatter.format(totalUserCount)}
          decoration={secondaryDecoration}
        />
        <MetricCard
          title="本日のユーザー登録数"
          value={numberFormatter.format(todayUserCount)}
          decoration={chart2Decoration}
        />
        <MetricCard
          title="サンプル指標A"
          value="27,182"
          decoration={chart1Decoration}
        />
        <MetricCard
          title="サンプル指標B"
          value="¥12,358"
          decoration={chart1Decoration}
        />
      </Grid>
    </Section>
  );
}
