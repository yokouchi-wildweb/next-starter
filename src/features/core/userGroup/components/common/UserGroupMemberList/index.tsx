// src/features/core/userGroup/components/common/UserGroupMemberList/index.tsx
// 部品(props だけ): 人の要約(先頭 3 名 + 計 N 名、D93)と、利用者を選ぶ部品で選んで足す。一覧(検索・まとめて外す)はサブのモーダル。
// 静的グループの一員と例外の人(入れる人・外す人)で使う。流れは hook useUserGroupStaticMembers / useUserGroupExceptions。
// draft = 作る前の下書き(選ぶ部品だけを出し、選んだ人は作成の時に書く。一覧・追加のボタンは出さない)

"use client";

import { Button } from "@/components/Form/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Span } from "@/components/TextBlocks/Span";

import { UserAsyncMultiSelect } from "@/features/core/user/components/common/UserAsyncMultiSelect";
import type { UserGroupMembershipEditorState } from "@/features/core/userGroup/hooks/useUserGroupMembershipEditor";
import type { UserGroupPeopleState } from "@/features/core/userGroup/hooks/useUserGroupPeople";

import { UserGroupMembershipPicker } from "../UserGroupMembershipPicker";
import { UserGroupPeopleModal } from "../UserGroupPeopleModal";
import { UserGroupPeopleSummary } from "../UserGroupPeopleSummary";

export type UserGroupMemberDraft = { value: string[]; onChange: (values: readonly (string | number | boolean)[]) => void; hint: string };

export type UserGroupMemberListProps = {
  title: string;
  description?: string;
  addLabel: string;
  emptyText: string;
  disabled?: boolean;
  /** 全部の人数(要約の「計 N 名」。null = 分からない) */
  total?: number | null;
  /** 一員をその場で直す部品の流れ(D101。渡すと選ぶ部品 + 追加の代わりに適用の形) */
  editor?: UserGroupMembershipEditorState;
} & ({ people: UserGroupPeopleState; draft?: never } | { draft: UserGroupMemberDraft; people?: never });

export function UserGroupMemberList(props: UserGroupMemberListProps) {
  const { title, description, addLabel, emptyText, disabled = false, total = null, editor } = props;
  if (props.draft) {
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
        <UserAsyncMultiSelect value={props.draft.value} onChange={props.draft.onChange} />
        <Para size="sm" tone="muted" className="my-0">
          {props.draft.hint}
        </Para>
      </Stack>
    );
  }
  const people = props.people;
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
      {!disabled && editor ? (
        <UserGroupMembershipPicker editor={editor} />
      ) : !disabled ? (
        <Flex align="start" gap="xs" wrap="wrap">
          <Stack space={1} className="min-w-64 flex-1">
            <UserAsyncMultiSelect value={people.picks} onChange={people.setPicks} />
          </Stack>
          {/* 選ぶ欄(トリガーは py-3 の h-auto)の 1 行の高さに合わせる。選んだ人が増えて欄が伸びてもボタンは上の 1 行ぶんのまま */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-auto py-3"
            disabled={people.busy || people.picks.length === 0}
            onClick={() => void people.add()}
          >
            {addLabel}
          </Button>
        </Flex>
      ) : null}
      <UserGroupPeopleSummary
        names={people.summary.items.map((person) => person.name)}
        total={total}
        loading={people.summary.isInitialLoading}
        onOpenList={() => people.setListOpen(true)}
      />
      <UserGroupPeopleModal title={title} people={people} emptyText={emptyText} disabled={disabled} total={total} />
    </Stack>
  );
}
