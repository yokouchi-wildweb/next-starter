// src/features/core/userGroup/components/common/UserGroupExceptionsEditor/index.tsx
// 部品(props だけ): 例外の人(動的・定期計算)。入れる人(条件に合わなくても入れる)と外す人(条件に合っても外す)の 2 つの一覧。
// 片方に足した人はもう片方から外れる。定期計算は次の計算で反映。流れは hook useUserGroupExceptions。
// 作る前は draft(選んだ人をフォームに持ち、作成の時にグループと一緒に書く。useUserGroupForm の exceptionsDraft)

"use client";

import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

import { UserGroupMemberList } from "@/features/core/userGroup/components/common/UserGroupMemberList";
import type { UserGroupExceptionsState } from "@/features/core/userGroup/hooks/useUserGroupExceptions";

export type UserGroupExceptionsDraft = {
  include: string[];
  exclude: string[];
  setInclude: (values: readonly (string | number | boolean)[]) => void;
  setExclude: (values: readonly (string | number | boolean)[]) => void;
};

export type UserGroupExceptionsEditorProps = {
  /** 保存済みのグループの例外の人(draft と どちらか) */
  exceptions?: UserGroupExceptionsState;
  /** 作る前の下書き */
  draft?: UserGroupExceptionsDraft;
  /** 人数(1 件の exceptions) */
  counts: { includeCount: number; excludeCount: number } | null;
  scheduled?: boolean;
  disabled?: boolean;
};

const DRAFT_HINT = "作成すると、グループと一緒に追加されます";

export function UserGroupExceptionsEditor({ exceptions, draft, counts, scheduled = false, disabled = false }: UserGroupExceptionsEditorProps) {
  const includeSource = draft
    ? { draft: { value: draft.include, onChange: draft.setInclude, hint: DRAFT_HINT } }
    : { people: exceptions!.include };
  const excludeSource = draft
    ? { draft: { value: draft.exclude, onChange: draft.setExclude, hint: DRAFT_HINT } }
    : { people: exceptions!.exclude };
  return (
    <Stack space={3} data-slot="user-group-exceptions">
      <Para size="sm" tone="muted" className="my-0">
        条件に関係なく、特定のユーザーを常に含める・常に除外することができます。一方に追加したユーザーは、もう一方から削除されます
        {scheduled ? "(「定期的に更新」のグループは次の更新で反映されます)" : ""}
      </Para>
      <UserGroupMemberList
        title={`常に含める人${counts ? `(${counts.includeCount.toLocaleString("ja-JP")} 人)` : ""}`}
        description="条件に合わなくても、このグループに含めるユーザー"
        {...includeSource}
        total={counts?.includeCount ?? null}
        addLabel="追加"
        emptyText="常に含める人はいません"
        disabled={disabled}
      />
      <UserGroupMemberList
        title={`常に除外する人${counts ? `(${counts.excludeCount.toLocaleString("ja-JP")} 人)` : ""}`}
        description="条件に合っても、このグループから除外するユーザー"
        {...excludeSource}
        total={counts?.excludeCount ?? null}
        addLabel="追加"
        emptyText="常に除外する人はいません"
        disabled={disabled}
      />
    </Stack>
  );
}
