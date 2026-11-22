// src/domains/core/messaging/components/DefinitionSendModal/DefinitionSendConfirm.tsx
// 部品(props だけ): 定義連絡の汎用の送るモーダルの確認の段。送る連絡・宛先の文・送信方法・送る時刻・定義の確認の文(adminText.confirm)。
// 人数の見込みは無い(全員・ロール・グループの上限はサーバーが断る)

"use client";

import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

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
};

export function DefinitionSendConfirm({ definitionLabel, recipients, channels, scheduledAt, confirmText }: DefinitionSendConfirmProps) {
  return (
    <Stack gap="xs" data-slot="definition-send-confirm">
      <Para size="sm" className="my-0">
        連絡: {definitionLabel}
      </Para>
      <Para size="sm" className="my-0">
        宛先: {recipients}
      </Para>
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
