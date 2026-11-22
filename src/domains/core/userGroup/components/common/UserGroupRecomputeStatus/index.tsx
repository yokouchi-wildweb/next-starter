// src/domains/core/userGroup/components/common/UserGroupRecomputeStatus/index.tsx
// 部品(props だけ): 定期計算の今の様子。間隔・最後に計算し終えた時刻・計算中・最後の失敗(理由)。一覧の行とモーダルで使う
// inline = 一覧の行で人数の右に括弧で添える形(親の Flex の中に置く)

import { Flex } from "@/components/Layout/Flex";
import { Span } from "@/components/TextBlocks/Span";

import type { AdminUserGroupRecompute } from "@/domains/core/userGroup/services/client/userGroupAdminClient";

export type UserGroupRecomputeStatusProps = {
  recompute: AdminUserGroupRecompute;
  /** 失敗の理由も出す(一覧の行は出さない) */
  showReason?: boolean;
  /** 括弧でくくった 1 続きの文で出す(一覧の行で人数の右に添える) */
  inline?: boolean;
};

const when = (iso: string | null) => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString("ja-JP");
};

const every = (minutes: number) => (minutes % 1440 === 0 ? `${minutes / 1440} 日ごと` : minutes % 60 === 0 ? `${minutes / 60} 時間ごと` : `${minutes} 分ごと`);

export function UserGroupRecomputeStatus({ recompute, showReason = false, inline = false }: UserGroupRecomputeStatusProps) {
  const last = when(recompute.lastComputedAt);
  const failedAt = recompute.lastFailure ? when(recompute.lastFailure.at) : null;
  const interval = recompute.intervalMinutes === null ? `既定(${every(recompute.defaultIntervalMinutes)})` : every(recompute.intervalMinutes);
  const failureText = recompute.lastFailure
    ? `更新に失敗${failedAt ? `(${failedAt})` : ""}${showReason && recompute.lastFailure.reason ? `: ${recompute.lastFailure.reason}` : ""}`
    : null;
  if (inline) {
    const parts = [interval, last ? `最終更新 ${last}` : "まだ更新されていません", recompute.computing ? "更新中" : null].filter(Boolean);
    return (
      <>
        <Span size="sm" tone="muted" data-slot="user-group-recompute">
          {`(${parts.join("・")})`}
        </Span>
        {failureText ? (
          <Span size="sm" tone="destructive" data-slot="user-group-recompute-failure">
            {failureText}
          </Span>
        ) : null}
      </>
    );
  }
  return (
    <Flex gap="md" wrap="wrap" data-slot="user-group-recompute">
      <Span size="sm" tone="muted">
        {interval}
      </Span>
      <Span size="sm" tone="muted">
        {last ? `最終更新 ${last}` : "まだ更新されていません"}
      </Span>
      {recompute.computing ? (
        <Span size="sm" tone="muted">
          更新中
        </Span>
      ) : null}
      {failureText ? (
        <Span size="sm" tone="destructive" data-slot="user-group-recompute-failure">
          {failureText}
        </Span>
      ) : null}
    </Flex>
  );
}
