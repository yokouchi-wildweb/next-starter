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

const blueDecoration: MetricCardDecoration = {
  gradient: "from-sky-500/25 via-sky-400/10 to-transparent",
  glow: "bg-sky-300/40",
  beam: "bg-sky-100/40",
  shadow: "shadow-[0_18px_45px_-20px_rgba(14,165,233,0.55)]",
};

const cyanDecoration: MetricCardDecoration = {
  gradient: "from-cyan-200/25 via-cyan-100/10 to-transparent",
  glow: "bg-cyan-200/25",
  beam: "bg-cyan-100/25",
  shadow: "shadow-[0_18px_45px_-20px_rgba(14,165,233,0.55)]",
};

const violetDecoration: MetricCardDecoration = {
  gradient: "from-violet-300/25 via-violet-100/10 to-transparent",
  glow: "bg-violet-300/40",
  beam: "bg-violet-100/40",
  shadow: "shadow-[0_18px_45px_-20px_rgba(139,92,246,0.55)]",
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
          decoration={blueDecoration}
        />
        <MetricCard
          title="本日のユーザー登録数"
          value={numberFormatter.format(todayUserCount)}
          decoration={cyanDecoration}
        />
        <MetricCard
          title="サンプル指標A"
          value="27,182"
          decoration={violetDecoration}
        />
        <MetricCard
          title="サンプル指標B"
          value="¥12,358"
          decoration={violetDecoration}
        />
      </Grid>
    </Section>
  );
}
