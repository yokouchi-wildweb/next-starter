// src/app/admin/(protected)/page.tsx

import dayjs from "dayjs";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/_shadcn/card";
import { DeveloperMotivationChart } from "@/components/AppFrames/Admin/Elements/DeveloperMotivationChart";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import SecTitle from "@/components/AppFrames/Admin/Elements/SecTitle";
import { Flex } from "@/components/Layout/Flex";
import { Grid } from "@/components/Layout/Grid";
import { Section } from "@/components/Layout/Section";
import { Span } from "@/components/TextBlocks";
import { cn } from "@/lib/cn";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { userService } from "@/features/core/user/services/server/userService";
import type { UserRoleType } from "@/features/core/user/types";
import { Block } from "@/components/Layout/Block";

export const dynamic = "force-dynamic";
export default async function AdminHomePage() {
  const ROLE_USER: UserRoleType = "user";
  const now = dayjs();
  const startOfToday = now.startOf("day");
  const startOfTomorrow = startOfToday.add(1, "day");
  const { showMainMetrics, showAdditionalMetrics } = APP_FEATURES.admin.dashboard.sections;

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

  const numberFormatter = new Intl.NumberFormat("ja-JP");
  const metrics = [
    {
      key: "totalUsers",
      title: "ユーザー登録総数",
      value: numberFormatter.format(totalUserCount),
      gradient: "from-sky-500/25 via-sky-400/10 to-transparent",
      glow: "bg-sky-300/40",
      beam: "bg-sky-100/40",
      shadow: "shadow-[0_18px_45px_-20px_rgba(14,165,233,0.55)]",
    },
    {
      key: "todayUsers",
      title: "本日のユーザー登録数",
      value: numberFormatter.format(todayUserCount),
      gradient: "from-cyan-200/25 via-cyan-100/10 to-transparent",
      glow: "bg-cyan-200/25",
      beam: "bg-cyan-100/25",
      shadow: "shadow-[0_18px_45px_-20px_rgba(14,165,233,0.55)]",

    },
    {
      key: "sampleA",
      title: "サンプル指標A",
      value: "27,182",
      gradient: "from-violet-300/25 via-violet-100/10 to-transparent",
      glow: "bg-violet-300/40",
      beam: "bg-violet-100/40",
      shadow: "shadow-[0_18px_45px_-20px_rgba(139,92,246,0.55)]",
    },
    {
      key: "sampleB",
      title: "サンプル指標B",
      value: "¥12,358",
      gradient: "from-violet-300/25 via-violet-100/10 to-transparent",
      glow: "bg-violet-300/40",
      beam: "bg-violet-100/40",
      shadow: "shadow-[0_18px_45px_-20px_rgba(139,92,246,0.55)]",
    },
  ];

  return (
    <AdminPage>
      <Block space="lg">

        <PageTitle>管理ダッシュボード</PageTitle>

        {showMainMetrics && (
          <Section id='main-metrics'>
            <SecTitle>
              サービスの稼働状況
            </SecTitle>

            <Grid columns="two" gap="md" className="sm:gap-6 lg:grid-cols-4">
              {metrics.map((metric) => (
                <Card
                  key={metric.key}
                  className={cn(
                    "max-sm:gap-1 relative overflow-hidden border-0 bg-slate-700 text-slate-50",
                    metric.shadow,
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
                      metric.gradient,
                    )}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute -right-16 top-1/2 h-52 w-52 -translate-y-1/2 rounded-full blur-3xl",
                      metric.glow,
                    )}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute -left-20 top-0 h-32 w-40 -translate-y-1/3 rotate-12 blur-2xl",
                      metric.beam,
                    )}
                  />
                  <CardHeader className="relative z-10 pb-1 sm:pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-200/90 sm:text-sm">
                      {metric.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative z-10 pt-0 sm:pt-1">
                    <Flex direction="column" gap="sm">
                      <Span className="text-slate-50 text-3xl font-semibold tracking-tight drop-shadow-[0_12px_35px_rgba(15,23,42,0.45)] sm:text-[2.5rem] lg:text-5xl">
                        {metric.value}
                      </Span>
                    </Flex>
                  </CardContent>
                </Card>
              ))}
            </Grid>
          </Section>
        )}

        {showAdditionalMetrics && (
          <Section id='addinl-metrics'>
            <SecTitle>
              追加の指標
            </SecTitle>

            <Flex wrap="wrap" gap="lg" justify="center" className="lg:justify-start">
              <Card
                className="max-sm:p-4 max-sm:gap-0 w-full lg:w-1/2 text-slate-900 bg-gradient-to-br from-zinc-100 via-zinc-300/80 to-zinc-500/70 rounded-xl shadow-lg border border-white/30"
              >
                <CardHeader>
                  <CardTitle>グラフ指標サンプル</CardTitle>
                </CardHeader>
                <CardContent>
                  <Flex justify="center" align="center">
                    <DeveloperMotivationChart percentage={APP_FEATURES.coffeeLevel ?? 0} />
                  </Flex>
                </CardContent>
              </Card>
            </Flex>
          </Section>
        )}

      </Block>
    </AdminPage>
  );
}
