// src/features/core/admin/dashboard/components/sections/AdditionalMetricsSection.tsx

import { Card, CardContent, CardHeader, CardTitle } from "@/components/_shadcn/card";
import { DeveloperMotivationChart } from "@/components/AppFrames/Admin/Elements/DeveloperMotivationChart";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import SecTitle from "@/components/AppFrames/Admin/Elements/SecTitle";
import { APP_FEATURES } from "@/config/app/app-features.config";

/**
 * 追加の指標セクション。
 * テンプレート用のサンプルチャートを表示する。
 *
 * 機能フラグ `APP_FEATURES.adminConsole.dashboard.showAdditionalMetrics` で表示制御。
 * 無効時は何も描画しない。
 *
 * ダウンストリームでは:
 * - チャート種別を差し替えるなら本ファイルを編集
 * - セクションごと不要なら registry.ts から外す
 */
export function AdditionalMetricsSection() {
  if (!APP_FEATURES.adminConsole.dashboard.showAdditionalMetrics) {
    return null;
  }

  return (
    <Section id="additional-metrics">
      <SecTitle>追加の指標</SecTitle>

      <Flex wrap="wrap" gap="lg" justify="center" className="lg:justify-start">
        <Card className="max-sm:p-4 max-sm:gap-0 w-full lg:w-1/2 text-slate-900 bg-gradient-to-br from-zinc-100 via-zinc-300/80 to-zinc-500/70 rounded-xl shadow-lg border border-white/30">
          <CardHeader>
            <CardTitle>グラフ指標サンプル</CardTitle>
          </CardHeader>
          <CardContent>
            <Flex justify="center" align="center">
              <DeveloperMotivationChart
                percentage={APP_FEATURES.adminConsole.dashboard.coffeeLevel}
              />
            </Flex>
          </CardContent>
        </Card>
      </Flex>
    </Section>
  );
}
