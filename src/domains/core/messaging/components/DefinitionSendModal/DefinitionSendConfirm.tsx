// src/domains/core/messaging/components/DefinitionSendModal/DefinitionSendConfirm.tsx
// 部品(props だけ): 定義連絡の汎用の送るモーダルの確認の段。送る連絡・宛先の文・送信方法・送る時刻・定義の確認の文(adminText.confirm)。
// 全員・ロール・グループは人数の見込み(部品 RecipientEstimateView、自由連絡の確認と同じ表示。上限を超えた理由も)。記録の入口は見込みを渡さない

"use client";

import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

import { RecipientEstimateView } from "@/domains/core/messaging/components/common/SendConfirmView";

export type DefinitionSendConfirmProps = {
  /** 送る連絡の表示名 */
  definitionLabel: string;
  /** 宛先の文(呼び手が組む: 記録 = 「選択した n 件の<名詞>に関連するユーザー」/ 全員・ロール・グループ) */
  recipients: string;
  /** 送信方法の表示名 */
  channels: string[];
  /** 予約の時刻(ISO、今送るなら null) */
  scheduledAt: string | null;
  /** 定義の確認の文(無ければ出さない) */
  confirmText?: string | null;
  /** 人数の見込み(全員・ロール・グループ。undefined = 行を出さない(記録の入口)、null = まだ「-」) */
  estimate?: { count: number; overLimit?: boolean; memberLimit?: number } | null;
};

export function DefinitionSendConfirm({ definitionLabel, recipients, channels, scheduledAt, confirmText, estimate }: DefinitionSendConfirmProps) {
  return (
    <Stack gap="xs" data-slot="definition-send-confirm">
      <Para size="sm" className="my-0">
        連絡: {definitionLabel}
      </Para>
      <Para size="sm" className="my-0">
        宛先: {recipients}
      </Para>
      {estimate !== undefined ? <RecipientEstimateView estimate={estimate} label="人数" /> : null}
      <Para size="sm" className="my-0">
        送信方法: {channels.join("・") || "-"}
      </Para>
      <Para size="sm" className="my-0">
        送信日時: {scheduledAt ? new Date(scheduledAt).toLocaleString("ja-JP") : "今すぐ"}
      </Para>
      {confirmText ? (
        <Para size="sm" tone="warning" className="my-0" data-slot="definition-send-confirm-text">
          {confirmText}
        </Para>
      ) : null}
    </Stack>
  );
}
