// src/domains/core/userGroup/components/common/UserGroupPeopleModal/index.tsx
// 部品(props だけ、流れは hook useUserGroupPeople): 人の一覧のサブのモーダル(D93)。
// 名前の検索・無限スクロール(カーソル)・行ごとのチェック(行のどこを押しても選べる、乗ると色、選んだ行は primary の薄い地)・「選んだ N 名を削除」(Dialog)・「全員を削除(計 N 名)」(Dialog、
// 検索に関係なく全部。検索を入れている間は押せない、D94)。グループのモーダルの上に重ねて開く

"use client";

import { useState } from "react";

import { Button } from "@/components/Button/Button";
import { BooleanCheckboxInput } from "@/components/Input/BooleanCheckboxInput";
import { Input } from "@/components/Input/Input";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import Modal from "@/components/Overlays/Modal";
import { Dialog } from "@/components/Overlays/Dialog";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";

import type { UserGroupPeopleState } from "@/domains/core/userGroup/hooks/useUserGroupPeople";

export type UserGroupPeopleModalProps = {
  title: string;
  people: UserGroupPeopleState;
  emptyText: string;
  /** 外せない(アーカイブ済みなど) */
  disabled?: boolean;
  /** 全部の人数(「全員を削除(計 N 名)」。null = 分からない) */
  total?: number | null;
};

export function UserGroupPeopleModal({ title, people, emptyText, disabled = false, total = null }: UserGroupPeopleModalProps) {
  const { query } = people;
  const [clearOpen, setClearOpen] = useState(false);
  // 選んだ人の削除も全員の削除と同じ Dialog で確かめる(確かめ方を揃える)
  const [removeOpen, setRemoveOpen] = useState(false);
  const totalText = total !== null ? `計 ${total.toLocaleString("ja-JP")} 名` : "全員";
  const count = people.selectedIds.length;
  return (
    <Modal open={people.listOpen} onOpenChange={people.setListOpen} title={title} maxWidth="560px">
      <Stack gap="sm" data-slot="user-group-people-modal">
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
            <Stack gap="2xs">
              {items.map((person) => {
                const selected = people.isSelected(person.id);
                const name = person.name ?? "名前未設定のユーザー";
                // 行のどこを押しても選ぶ・外す(マウスの手間を減らす)。キーボードはチェックボックスで操作する
                return (
                  <Flex
                    key={person.id}
                    align="center"
                    gap="md"
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
          <Flex align="center" justify="end" gap="xs" wrap="wrap">
            {people.searching ? (
              <Span size="xs" tone="muted">
                検索を消すと使えます
              </Span>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="destructiveOutline"
              disabled={people.searching || people.busy || total === 0}
              onClick={() => setClearOpen(true)}
            >
              {`全員を削除(${totalText})`}
            </Button>
            <Button type="button" size="sm" variant="destructive" disabled={count === 0 || people.busy} onClick={() => setRemoveOpen(true)}>
              {`選んだ ${count} 名を削除`}
            </Button>
          </Flex>
        ) : null}
      </Stack>
      <Dialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={`${count} 名を削除`}
        description="選んだユーザーをこの一覧から削除します。"
        confirmLabel="削除する"
        confirmVariant="destructive"
        cancelLabel="キャンセル"
        onConfirm={async () => {
          await people.removeMany(people.selectedIds);
          setRemoveOpen(false);
        }}
      />
      <Dialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="全員を削除"
        description={`${title.replace(/[(（].*[)）]$/, "")}の${total !== null ? ` ${total.toLocaleString("ja-JP")} 名` : ""}を全員削除します。元に戻せません。`}
        confirmLabel="全員を削除する"
        confirmVariant="destructive"
        cancelLabel="キャンセル"
        onConfirm={async () => {
          await people.clearAll();
          setClearOpen(false);
        }}
      />
    </Modal>
  );
}
