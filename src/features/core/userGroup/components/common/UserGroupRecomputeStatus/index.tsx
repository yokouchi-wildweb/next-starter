// src/features/core/userGroup/components/common/UserGroupRecomputeStatus/index.tsx
// 部品(props だけ): 定期計算の今の様子。間隔・最後に計算し終えた時刻・計算中・最後の失敗(理由)。一覧の行とモーダルで使う

import { Flex } from "@/components/Layout/Flex";
import { Span } from "@/components/TextBlocks/Span";

import type { AdminUserGroupRecompute } from "@/features/core/userGroup/services/client/userGroupAdminClient";

export type UserGroupRecomputeStatusProps = {
  recompute: AdminUserGroupRecompute;
  /** 失敗の理由も出す(一覧の行は出さない) */
  showReason?: boolean;
};

const when = (iso: string | null) => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString("ja-JP");
};

const every = (minutes: number) => (minutes % 1440 === 0 ? `${minutes / 1440} 日ごと` : minutes % 60 === 0 ? `${minutes / 60} 時間ごと` : `${minutes} 分ごと`);

export function UserGroupRecomputeStatus({ recompute, showReason = false }: UserGroupRecomputeStatusProps) {
  const last = when(recompute.lastComputedAt);
  const failedAt = recompute.lastFailure ? when(recompute.lastFailure.at) : null;
  return (
    <Flex gap="sm" wrap="wrap" data-slot="user-group-recompute">
      <Span size="sm" tone="muted">
        {recompute.intervalMinutes === null ? `既定の間隔(${every(recompute.defaultIntervalMinutes)})` : every(recompute.intervalMinutes)}
      </Span>
      <Span size="sm" tone="muted">
        {last ? `最後の計算 ${last}` : "まだ計算していません"}
      </Span>
      {recompute.computing ? (
        <Span size="sm" tone="muted">
          計算中
        </Span>
      ) : null}
      {recompute.lastFailure ? (
        <Span size="sm" tone="destructive" data-slot="user-group-recompute-failure">
          {`計算に失敗${failedAt ? `(${failedAt})` : ""}${showReason && recompute.lastFailure.reason ? `: ${recompute.lastFailure.reason}` : ""}`}
        </Span>
      ) : null}
    </Flex>
  );
}
