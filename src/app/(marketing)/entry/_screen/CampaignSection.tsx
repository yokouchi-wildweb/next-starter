// src/app/(marketing)/entry/_components/CampaignSection.tsx
// 事前登録キャンペーン情報セクション（プレースホルダー）

import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { SecTitle, Para } from "@/components/TextBlocks";

/**
 * キャンペーンセクション
 *
 * フォーク先プロジェクトでカスタマイズすることを想定したプレースホルダー。
 * 以下のような情報を含めることを想定：
 * - キャンペーン特典・限定オファー
 * - サービス概要・価値提案
 * - カウントダウンタイマー
 * - 登録者数・目標数
 */
export function CampaignSection() {
  return (
    <Section id="campaign" paddingBlock="lg" className="text-center">
      <Stack space={6}>
        {/* メインビジュアル・キャッチコピー */}
        <Stack space={2}>
          <SecTitle as="h2" size="xxl" align="center">
            事前登録キャンペーン実施中
          </SecTitle>
          <Para size="lg" tone="muted" align="center">
            {/* TODO: キャッチコピーをカスタマイズ */}
            今なら事前登録で限定特典をプレゼント
          </Para>
        </Stack>

        {/* 特典・オファー情報 */}
        <Stack space={4} className="mx-auto max-w-md rounded-lg border border-border bg-surface p-6">
          <SecTitle as="h3" size="lg" align="center">
            限定特典
          </SecTitle>
          <ul className="space-y-2 text-left text-sm">
            {/* TODO: 特典リストをカスタマイズ */}
            <li className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>特典1: プレースホルダー</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>特典2: プレースホルダー</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>特典3: プレースホルダー</span>
            </li>
          </ul>
        </Stack>

        {/* 追加情報エリア（カウントダウン、登録者数など） */}
        <Para size="sm" tone="muted" align="center">
          {/* TODO: 期間限定情報などをカスタマイズ */}
          ※ 特典内容は予告なく変更される場合があります
        </Para>
      </Stack>
    </Section>
  );
}
