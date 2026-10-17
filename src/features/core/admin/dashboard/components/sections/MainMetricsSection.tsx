// src/features/core/admin/dashboard/components/sections/MainMetricsSection.tsx

import dayjs from "dayjs";

import { Grid } from "@/components/Layout/Grid";
import { Section } from "@/components/Layout/Section";
import SecTitle from "@/components/AppFrames/Admin/Elements/SecTitle";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { userService } from "@/features/user/services/server/userService";
import type { UserRoleType } from "@/features/user/types";

import { MetricCard, type MetricCardDecoration } from "../parts/MetricCard";

const ROLE_USER: UserRoleType = "user";

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
 * - ユーザー登録総数 / 本日のユーザー登録数を userService から並列取得
 * - サンプル指標2つはダミー値 (テンプレート用)
 *
 * 機能フラグ `APP_FEATURES.adminConsole.dashboard.showMainMetrics` で表示制御。
 * 無効時は何も描画しない (registry から外したのと同等の見た目になる)。
 *
 * このコンポーネントは Server Component。データ取得は内部で完結するため、
 * page.tsx 側に変更を波及させない。
 */
export async function MainMetricsSection() {
  if (!APP_FEATURES.adminConsole.dashboard.showMainMetrics) {
    return null;
  }

  const now = dayjs();
  const startOfToday = now.startOf("day");
  const startOfTomorrow = startOfToday.add(1, "day");

  const [{ total: totalUserCount }, { total: todayUserCount }] = await Promise.all([
    userService.search({
      limit: 1,
      where: { field: "role", op: "eq", value: ROLE_USER },
    }),
    userService.search({
      limit: 1,
      where: {
        and: [
          { field: "role", op: "eq", value: ROLE_USER },
          { field: "createdAt", op: "gte", value: startOfToday.toDate() },
          { field: "createdAt", op: "lt", value: startOfTomorrow.toDate() },
        ],
      },
    }),
  ]);

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
