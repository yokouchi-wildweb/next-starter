// src/features/core/userGroup/components/common/UserGroupPeopleSummary/index.tsx
// 部品(props だけ): 人の要約の 1 行(D93)。先頭 3 名の表示名 +「ほか 計 N 名」(0 なら「まだいません」)+「一覧を開く」

"use client";

import { Button } from "@/components/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Span } from "@/components/TextBlocks/Span";

export type UserGroupPeopleSummaryProps = {
  /** 先頭の人の表示名(3 名まで使う) */
  names: readonly (string | null)[];
  /** 全部の人数(null = 分からない) */
  total: number | null;
  loading?: boolean;
  onOpenList: () => void;
};

/** 要約の文 */
export function userGroupPeopleSummaryText(names: readonly (string | null)[], total: number | null): string {
  const shown = names.slice(0, 3).map((name) => name ?? "名前未設定のユーザー");
  const count = total ?? shown.length;
  if (count === 0 || shown.length === 0) return "まだいません";
  const head = shown.join("、");
  return count > shown.length ? `${head} ほか 計 ${count.toLocaleString("ja-JP")} 名` : `${head}(計 ${count.toLocaleString("ja-JP")} 名)`;
}

export function UserGroupPeopleSummary({ names, total, loading = false, onOpenList }: UserGroupPeopleSummaryProps) {
  const empty = !loading && (total === 0 || names.length === 0);
  return (
    <Flex align="center" justify="between" gap="md" wrap="wrap" data-slot="user-group-people-summary">
      <Span size="sm" tone={empty ? "muted" : undefined} className="min-w-0">
        {loading && names.length === 0 ? "読み込み中…" : userGroupPeopleSummaryText(names, total)}
      </Span>
      <Button type="button" size="sm" variant="outline" disabled={empty} onClick={onOpenList}>
        一覧を開く
      </Button>
    </Flex>
  );
}
