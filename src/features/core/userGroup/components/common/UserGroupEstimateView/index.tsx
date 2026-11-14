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
        <Span weight="semiBold">人数の見込み</Span>
        <Button type="button" size="sm" variant="outline" disabled={!canRun} onClick={onRun}>
          {isLoading ? <Spinner className="size-4" /> : null}
          {result || reason ? "数え直す" : "今の条件で数える"}
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
              {`人数の上限(${result.memberLimit.toLocaleString("ja-JP")} 人)を超えています。送る宛先・固定のグループには使えません`}
            </Para>
          ) : null}
          {result.sample.length > 0 ? (
            <Para size="sm" tone="muted" className="my-0" data-slot="estimate-sample">
              {`試し: ${result.sample.map((user) => user.name ?? "名前のない利用者").join("、")}`}
            </Para>
          ) : (
            <Para size="sm" tone="muted" className="my-0">
              当てはまる人はいません
            </Para>
          )}
        </Stack>
      ) : null}
      {stale ? (
        <Para size="sm" tone="muted" className="my-0">
          条件を変えたので、数え直すと今の見込みになります
        </Para>
      ) : null}
      {!result && !reason ? (
        <Para size="sm" tone="muted" className="my-0">
          保存の前でも、今の条件で人数と何人かの名前を見られます
        </Para>
      ) : null}
    </Stack>
  );
}
