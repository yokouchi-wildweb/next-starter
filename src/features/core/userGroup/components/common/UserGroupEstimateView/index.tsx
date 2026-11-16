// src/features/core/userGroup/components/common/UserGroupEstimateView/index.tsx
// 部品(props だけ): 人数の見込みと試しの一覧(保存しない定義でも数える)。押した時だけ数え、数えられない理由(時間の上限など)を出す。
// 試しは表示名だけ(id・メールは出さない)。流れは hook useUserGroupEstimate

"use client";

import { Button } from "@/components/Form/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";

import type { AdminUserGroupEstimate } from "@/features/core/userGroup/services/client/userGroupAdminClient";

export type UserGroupEstimateViewProps = {
  result: AdminUserGroupEstimate | null;
  reason: string | null;
  isLoading: boolean;
  /** 数えた後に条件を変えた */
  stale: boolean;
  canRun: boolean;
  onRun: () => void;
};

export function UserGroupEstimateView({ result, reason, isLoading, stale, canRun, onRun }: UserGroupEstimateViewProps) {
  return (
    <Stack space={2} className="rounded-md border border-border bg-muted/30 p-4" data-slot="user-group-estimate">
      <Flex align="center" justify="between" gap="xs" wrap="wrap">
        <Span weight="semiBold">対象人数の見積もり</Span>
        <Button type="button" size="sm" variant="outline" disabled={!canRun} onClick={onRun}>
          {isLoading ? <Spinner className="size-4" /> : null}
          {result || reason ? "再計算" : "見積もる"}
        </Button>
      </Flex>
      {reason ? (
        <Para size="sm" tone="destructive" className="my-0" data-slot="estimate-reason">
          {reason}
        </Para>
      ) : null}
      {result ? (
        <Stack space={1}>
          <Span data-slot="estimate-count">{`約 ${result.count.toLocaleString("ja-JP")} 人`}</Span>
          {result.overLimit ? (
            <Para size="sm" tone="warning" className="my-0">
              {`上限(${result.memberLimit.toLocaleString("ja-JP")} 人)を超えています。配信の宛先や固定グループには使えません`}
            </Para>
          ) : null}
          {result.sample.length > 0 ? (
            <Para size="sm" tone="muted" className="my-0" data-slot="estimate-sample">
              {`該当ユーザーの例: ${result.sample.map((user) => user.name ?? "名前未設定のユーザー").join("、")}`}
            </Para>
          ) : (
            <Para size="sm" tone="muted" className="my-0">
              該当するユーザーはいません
            </Para>
          )}
        </Stack>
      ) : null}
      {stale ? (
        <Para size="sm" tone="muted" className="my-0">
          条件が変更されました。再計算すると最新の見積もりになります
        </Para>
      ) : null}
      {!result && !reason ? (
        <Para size="sm" tone="muted" className="my-0">
          保存する前に、今の条件に該当する人数とユーザーの例を確認できます
        </Para>
      ) : null}
    </Stack>
  );
}
