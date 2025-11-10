// src/app/admin/(protected)/page.tsx

import dayjs from "dayjs";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/Shadcn/card";
import { DeveloperMotivationChart } from "@/components/Admin/DeveloperMotivationChart";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { Flex } from "@/components/Layout/Flex";
import { Grid } from "@/components/Layout/Grid";
import { SecTitle, Span } from "@/components/TextBlocks";
import { cn } from "@/lib/cn";
import { settingService } from "@/features/setting/services/server/settingService";
import { userService } from "@/features/user/services/server/userService";

export const dynamic = "force-dynamic";
export default async function AdminHomePage() {
  const setting = await settingService.getGlobalSetting();
  const now = dayjs();
  const startOfToday = now.startOf("day");
  const startOfTomorrow = startOfToday.add(1, "day");

  const [{ total: totalUserCount }, { total: todayUserCount }] = await Promise.all([
    userService.search({ limit: 1 }),
    userService.search({
      limit: 1,
      where: {
        and: [
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
      glow: "bg-sky-500/40",
      beam: "bg-sky-300/40",
      shadow: "shadow-[0_18px_45px_-20px_rgba(14,165,233,0.55)]",
    },
    {
      key: "todayUsers",
      title: "本日のユーザー登録数",
      value: numberFormatter.format(todayUserCount),
      gradient: "from-emerald-500/25 via-emerald-400/10 to-transparent",
      glow: "bg-emerald-500/40",
      beam: "bg-emerald-300/40",
      shadow: "shadow-[0_18px_45px_-20px_rgba(16,185,129,0.55)]",
    },
    {
      key: "sampleA",
      title: "サンプル指標A",
      value: "27,182",
      gradient: "from-violet-500/25 via-violet-400/10 to-transparent",
      glow: "bg-violet-500/40",
      beam: "bg-violet-300/40",
      shadow: "shadow-[0_18px_45px_-20px_rgba(139,92,246,0.55)]",
    },
    {
      key: "sampleB",
      title: "サンプル指標B",
      value: "¥11,235,813",
      gradient: "from-amber-500/25 via-amber-400/10 to-transparent",
      glow: "bg-amber-500/40",
      beam: "bg-amber-300/40",
      shadow: "shadow-[0_18px_45px_-20px_rgba(245,158,11,0.55)]",
    },
  ];

  return (
    <AdminPage variant="dashboard">
      <AdminPageTitle>管理ダッシュボード</AdminPageTitle>
      <Grid gap="lg" className="md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card
            key={metric.key}
            className={cn(
              "relative overflow-hidden border-0 bg-slate-950/90 text-slate-50",
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
            <CardHeader className="relative z-10">
              <CardTitle className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-200/90">
                {metric.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <Flex direction="column" gap="sm" className="mt-1">
                <Span className="text-5xl font-semibold tracking-tight drop-shadow-[0_12px_35px_rgba(15,23,42,0.45)] sm:text-6xl">
                  {metric.value}
                </Span>
              </Flex>
            </CardContent>
          </Card>
        ))}
      </Grid>
      <SecTitle variant="barAccent">追加の指標</SecTitle>

      <Grid gap="lg" className="md:grid-cols-1 lg:grid-cols-2">
        <Card
          className="text-slate-900 bg-gradient-to-br from-zinc-100 via-zinc-300/80 to-zinc-500/70 rounded-xl shadow-lg border border-white/30"
        >
          <CardHeader>
            <CardTitle>グラフ指標サンプル</CardTitle>
          </CardHeader>
          <CardContent>
            <Flex justify="center" align="center" width="full">
              <DeveloperMotivationChart percentage={setting.developerMotivation ?? 0} />
            </Flex>
          </CardContent>
        </Card>
      </Grid>
    </AdminPage>
  );
}
