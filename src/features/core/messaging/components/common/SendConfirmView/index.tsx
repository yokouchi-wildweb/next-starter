// src/features/core/messaging/components/common/SendConfirmView/index.tsx
// 部品(props だけ): 送るモーダルの確認の段(宛先数の見込み・送る時刻・テンプレートの版)と、結果の段(状態・回へのリンク・一括の後処理)

"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

import { LinkButton } from "@/components/Form/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";

export type SendConfirmViewProps = {
  /** 見込み(bulk は null で、選んだ記録の数を出す) */
  estimate: { count: number; capped: boolean } | null;
  bulk?: { recordCount: number; recordNoun: string } | null;
  /** 予約の時刻(ISO、今送るなら null) */
  scheduledAt: string | null;
  /** 呼び出したテンプレートの版(無ければ null) */
  templateVersion: number | null;
  channels: string[];
  categoryLabel: string;
};

export function SendConfirmView({ estimate, bulk, scheduledAt, templateVersion, channels, categoryLabel }: SendConfirmViewProps) {
  const who = bulk
    ? `選んだ ${bulk.recordCount} 件の${bulk.recordNoun}に紐づく利用者`
    : estimate
      ? `${estimate.count}${estimate.capped ? " 名以上" : " 名"}(送る時に数え直します)`
      : "-";
  return (
    <Stack space={2} data-slot="send-confirm-view">
      <Para size="sm" className="my-0">
        宛先: {who}
      </Para>
      <Para size="sm" className="my-0">
        カテゴリー: {categoryLabel} / 経路: {channels.join("・")}
      </Para>
      <Para size="sm" className="my-0">
        {scheduledAt ? `${new Date(scheduledAt).toLocaleString("ja-JP")} に予約します` : "今送ります"}
      </Para>
      {templateVersion ? (
        <Para size="sm" tone="muted" className="my-0">
          テンプレートは v{templateVersion} を元に送ります(直した文面はこの回に残ります)
        </Para>
      ) : null}
    </Stack>
  );
}

export type SendResultViewProps = {
  status: string;
  queuedCount: number;
  /** 回の画面の住所(無ければ出さない) */
  dispatchHref: string | null;
  /** 一括の後処理の結果(一括以外・項目に無ければ null) */
  afterSend?: { ok: true } | { ok: false; error: string } | null;
  recordNoun?: string;
};

export function SendResultView({ status, queuedCount, dispatchHref, afterSend, recordNoun }: SendResultViewProps) {
  return (
    <Stack space={3} data-slot="send-result-view">
      <Para size="sm" className="my-0">
        {status === "scheduled" ? "予約しました" : "送信を受け付けました"}(状態: {status}
        {queuedCount > 0 ? ` / 順に送る配達 ${queuedCount} 件` : ""})
      </Para>
      {afterSend ? (
        <Flex align="center" gap="xs">
          {afterSend.ok ? <CheckCircle2 className="size-4 text-success-text" /> : <AlertCircle className="size-4 text-destructive-text" />}
          <Span size="sm">
            {afterSend.ok ? `${recordNoun ?? "記録"}の送った後の処理を終えました` : `${recordNoun ?? "記録"}の送った後の処理に失敗しました: ${afterSend.error}`}
          </Span>
        </Flex>
      ) : null}
      {dispatchHref ? (
        <Flex>
          <LinkButton href={dispatchHref} size="sm" variant="outline">
            送った回を見る
          </LinkButton>
        </Flex>
      ) : null}
    </Stack>
  );
}
