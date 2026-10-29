// src/features/core/admin/dashboard/components/sections/AdditionalMetricsSection.tsx

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import SecTitle from "@/components/AppFrames/Admin/Elements/SecTitle";
import { Span } from "@/components/TextBlocks";
import { APP_FEATURES } from "@/config/app/app-features.config";

import { DeveloperMotivationChart } from "../parts/DeveloperMotivationChart";

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
        <Stack
          space={6}
          className="w-full rounded-xl border border-border bg-gradient-to-br from-muted via-muted-foreground/40 to-muted-foreground/70 py-6 text-foreground shadow-lg max-sm:gap-0 max-sm:p-4 lg:w-1/2"
        >
          <Block className="px-6">
            <Span weight="semiBold" className="leading-none">
              グラフ指標サンプル
            </Span>
          </Block>
          <Block className="px-6">
            <Flex justify="center" align="center">
              <DeveloperMotivationChart
                percentage={APP_FEATURES.adminConsole.dashboard.coffeeLevel}
              />
            </Flex>
          </Block>
        </Stack>
      </Flex>
    </Section>
  );
}
