// src/features/core/userGroup/components/common/UserGroupPeopleModal/index.tsx
// 部品(props だけ、流れは hook useUserGroupPeople): 人の一覧のサブのモーダル(D93)。
// 名前の検索・無限スクロール(カーソル)・行ごとのチェック(行のどこを押しても選べる、乗ると色、選んだ行は primary の薄い地)・「選んだ N 名を削除」(ConfirmPopover)。グループのモーダルの上に重ねて開く

"use client";

import { Button } from "@/components/Form/Button";
import { BooleanCheckboxInput, Input } from "@/components/Form/Input/Manual";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import Modal from "@/components/Overlays/Modal";
import { ConfirmPopover } from "@/components/Overlays/Popover";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";

import type { UserGroupPeopleState } from "@/features/core/userGroup/hooks/useUserGroupPeople";

export type UserGroupPeopleModalProps = {
  title: string;
  people: UserGroupPeopleState;
  emptyText: string;
  /** 外せない(アーカイブ済みなど) */
  disabled?: boolean;
};

export function UserGroupPeopleModal({ title, people, emptyText, disabled = false }: UserGroupPeopleModalProps) {
  const { query } = people;
  const count = people.selectedIds.length;
  return (
    <Modal open={people.listOpen} onOpenChange={people.setListOpen} title={title} maxWidth="560px">
      <Stack space={3} data-slot="user-group-people-modal">
        <Input aria-label="名前で検索" placeholder="名前で検索" value={people.q} onChange={(e) => people.setQ(e.target.value)} />
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
              {people.q.trim() ? "該当するユーザーはいません" : emptyText}
            </Para>
          }
          completedText="すべて表示しました"
        >
          {(items) => (
            <Stack space={1}>
              {items.map((person) => {
                const selected = people.isSelected(person.id);
                const name = person.name ?? "名前未設定のユーザー";
                // 行のどこを押しても選ぶ・外す(マウスの手間を減らす)。キーボードはチェックボックスで操作する
                return (
                  <Flex
                    key={person.id}
                    align="center"
                    gap="sm"
                    onClick={disabled ? undefined : () => people.toggle(person.id, !selected)}
                    className={[
                      "rounded-md px-3 py-2 transition-colors",
                      disabled ? "" : "cursor-pointer select-none hover:bg-muted",
                      selected ? "bg-primary/10 hover:bg-primary/15" : "",
                    ].join(" ")}
                    data-slot="user-group-person"
                    data-selected={selected ? "" : undefined}
                  >
                    {!disabled ? (
                      <Span className="inline-flex" onClick={(e) => e.stopPropagation()}>
                        <BooleanCheckboxInput
                          value={selected}
                          onChange={(on) => people.toggle(person.id, on === true)}
                          aria-label={`${name}を選ぶ`}
                        />
                      </Span>
                    ) : null}
                    <Span size="sm">{name}</Span>
                  </Flex>
                );
              })}
            </Stack>
          )}
        </InfiniteScrollList>
        {!disabled ? (
          <Flex justify="end">
            <ConfirmPopover
              trigger={
                <Button type="button" size="sm" variant="destructive" disabled={count === 0 || people.busy}>
                  {`選んだ ${count} 名を削除`}
                </Button>
              }
              title={`${count} 名を削除`}
              description="選んだユーザーをこの一覧から削除します。"
              confirmLabel="削除する"
              confirmVariant="destructive"
              onConfirm={() => people.removeMany(people.selectedIds)}
            />
          </Flex>
        ) : null}
      </Stack>
    </Modal>
  );
}
