// src/features/core/userGroup/components/common/UserGroupExceptionsEditor/index.tsx
// 部品(props だけ): 例外の人(動的・定期計算)。入れる人(条件に合わなくても入れる)と外す人(条件に合っても外す)の 2 つの一覧。
// 片方に足した人はもう片方から外れる。定期計算は次の計算で反映。流れは hook useUserGroupExceptions

"use client";

import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

import { UserGroupMemberList } from "@/features/core/userGroup/components/common/UserGroupMemberList";
import type { UserGroupExceptionsState } from "@/features/core/userGroup/hooks/useUserGroupExceptions";

export type UserGroupExceptionsEditorProps = {
  exceptions: UserGroupExceptionsState;
  /** 人数(1 件の exceptions) */
  counts: { includeCount: number; excludeCount: number } | null;
  scheduled?: boolean;
  disabled?: boolean;
};

export function UserGroupExceptionsEditor({ exceptions, counts, scheduled = false, disabled = false }: UserGroupExceptionsEditorProps) {
  return (
    <Stack space={3} data-slot="user-group-exceptions">
      <Para size="sm" tone="muted" className="my-0">
        条件とは別に、決まった人を入れる・外すことができます。片方に足した人はもう片方から外れます
        {scheduled ? "(定期計算のグループは次の計算で反映します)" : ""}
      </Para>
      <UserGroupMemberList
        title={`入れる人${counts ? `(${counts.includeCount.toLocaleString("ja-JP")} 人)` : ""}`}
        description="条件に合わなくてもこのグループに入れる人"
        people={exceptions.include}
        addLabel="入れる人に足す"
        emptyText="入れる人はいません"
        disabled={disabled}
      />
      <UserGroupMemberList
        title={`外す人${counts ? `(${counts.excludeCount.toLocaleString("ja-JP")} 人)` : ""}`}
        description="条件に合ってもこのグループから外す人"
        people={exceptions.exclude}
        addLabel="外す人に足す"
        emptyText="外す人はいません"
        disabled={disabled}
      />
    </Stack>
  );
}
