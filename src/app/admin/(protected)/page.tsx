// src/app/admin/(protected)/page.tsx

import { Card, CardContent, CardHeader, CardTitle } from "@/components/Shadcn/card";
import { DeveloperMotivationChart } from "@/components/Admin/DeveloperMotivationChart";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { Flex } from "@/components/Layout/Flex";
import { Grid } from "@/components/Layout/Grid";
import { SecTitle } from "@/components/TextBlocks";
import { settingService } from "@/features/setting/services/server/settingService";

export const dynamic = "force-dynamic";
export default async function AdminHomePage() {
  const setting = await settingService.getGlobalSetting();
  return (
    <AdminPage variant="dashboard">
      <AdminPageTitle>管理ダッシュボード</AdminPageTitle>
      <Grid gap="lg" className="md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle>サンプル指標{String.fromCharCode(65 + index)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-32 rounded bg-gradient-to-br from-gray-200 to-gray-500 " />
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
