// src/features/core/userGroup/components/common/UserGroupMemberList/index.tsx
// 部品(props だけ): 人の一覧(表示名、無限スクロール)と、利用者を選ぶ部品で選んで足す・1 人ずつ外す。
// 静的グループの一員と例外の人(入れる人・外す人)で使う。流れは hook useUserGroupStaticMembers / useUserGroupExceptions

"use client";

import { Button } from "@/components/Form/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Span } from "@/components/TextBlocks/Span";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";

import { UserAsyncMultiSelect } from "@/features/core/user/components/common/UserAsyncMultiSelect";
import type { UserGroupPeopleState } from "@/features/core/userGroup/hooks/useUserGroupPeople";

export type UserGroupMemberListProps = {
  title: string;
  description?: string;
  people: UserGroupPeopleState;
  addLabel: string;
  emptyText: string;
  disabled?: boolean;
};

export function UserGroupMemberList({ title, description, people, addLabel, emptyText, disabled = false }: UserGroupMemberListProps) {
  const { query } = people;
  return (
    <Stack space={3} className="rounded-md border border-border bg-card p-4" data-slot="user-group-people">
      <Stack space={1}>
        <SecTitle as="h3" size="md">
          {title}
        </SecTitle>
        {description ? (
          <Para size="sm" tone="muted" className="my-0">
            {description}
          </Para>
        ) : null}
      </Stack>
      {!disabled ? (
        <Flex align="start" gap="xs" wrap="wrap">
          <Stack space={1} className="min-w-64 flex-1">
            <UserAsyncMultiSelect value={people.picks} onChange={people.setPicks} />
          </Stack>
          <Button type="button" size="sm" variant="outline" disabled={people.busy || people.picks.length === 0} onClick={() => void people.add()}>
            {addLabel}
          </Button>
        </Flex>
      ) : null}
      <InfiniteScrollList
        items={query.items}
        isInitialLoading={query.isInitialLoading}
        isFetchingMore={query.isFetchingMore}
        hasMore={query.hasMore}
        error={query.error}
        sentinelRef={query.sentinelRef}
        onRetry={query.retry}
        emptyNode={
          <Para size="sm" tone="muted" align="center">
            {emptyText}
          </Para>
        }
        completedText="すべて表示しました"
      >
        {(items) => (
          <Stack space={1}>
            {items.map((person) => (
              <Flex key={person.id} align="center" justify="between" gap="xs" className="border-b border-border py-1" data-slot="user-group-person">
                <Span size="sm">{person.name ?? "名前未設定のユーザー"}</Span>
                {!disabled ? (
                  <Button type="button" size="sm" variant="ghost" disabled={people.busy} onClick={() => void people.remove(person.id)}>
                    削除
                  </Button>
                ) : null}
              </Flex>
            ))}
          </Stack>
        )}
      </InfiniteScrollList>
    </Stack>
  );
}
