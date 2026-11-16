// src/features/core/messaging/components/common/SendConfirmView/index.tsx
// 部品(props だけ): 送るモーダルの確認の段(宛先数の見込み・上限を超えた理由・送る時刻・テンプレートの版)と、結果の段(状態・回へのリンク・一括の後処理)

"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

import { LinkButton } from "@/components/Form/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";

import { DELIVERY_STATUS_DISPLAY } from "../DeliveryStatusBadge";
import { DISPATCH_STATUS_DISPLAY } from "../DispatchStatusBadge";

export type SendConfirmViewProps = {
  /** 見込み(bulk は null で、選んだ記録の数を出す)。overLimit = 人数の上限を超えた(理由を出す。送るは入れ物が止める) */
  estimate: { count: number; overLimit?: boolean; memberLimit?: number } | null;
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
    ? `選択した ${bulk.recordCount} 件の${bulk.recordNoun}に関連するユーザー`
    : estimate
      ? `${estimate.count} 名(送信時に再集計します)`
      : "-";
  return (
    <Stack gap="xs" data-slot="send-confirm-view">
      <Para size="sm" className="my-0">
        宛先: {who}
      </Para>
      {estimate?.overLimit ? (
        <Para size="sm" tone="destructive" className="my-0" data-slot="send-confirm-over-limit">
          {`宛先数 ${estimate.count.toLocaleString("ja-JP")} 人が上限 ${(estimate.memberLimit ?? 0).toLocaleString("ja-JP")} 人を超えているため送信できません`}
        </Para>
      ) : null}
      <Para size="sm" className="my-0">
        カテゴリー: {categoryLabel} / 送信方法: {channels.join("・")}
      </Para>
      <Para size="sm" className="my-0">
        {scheduledAt ? `${new Date(scheduledAt).toLocaleString("ja-JP")} に予約します` : "今すぐ送信します"}
      </Para>
      {templateVersion ? (
        <Para size="sm" tone="muted" className="my-0">
          テンプレート v{templateVersion} を元に送信します(編集した内容はこの送信に保存されます)
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
    <Stack gap="sm" data-slot="send-result-view">
      <Para size="sm" className="my-0">
        {status === "scheduled" ? "予約しました" : "送信を受け付けました"}(状態: {DISPATCH_STATUS_DISPLAY[status]?.label ?? "受け付け済み"}
        {queuedCount > 0 ? ` / ${DELIVERY_STATUS_DISPLAY.queued.label} ${queuedCount} 件` : ""})
      </Para>
      {afterSend ? (
        <Flex align="center" gap="xs">
          {afterSend.ok ? <CheckCircle2 className="size-4 text-success-text" /> : <AlertCircle className="size-4 text-destructive-text" />}
          <Span size="sm">
            {afterSend.ok ? `${recordNoun ?? "対象"}の送信後の処理が完了しました` : `${recordNoun ?? "対象"}の送信後の処理に失敗しました: ${afterSend.error}`}
          </Span>
        </Flex>
      ) : null}
      {dispatchHref ? (
        <Flex>
          <LinkButton href={dispatchHref} size="sm" variant="outline">
            送信の詳細を見る
          </LinkButton>
        </Flex>
      ) : null}
    </Stack>
  );
}
