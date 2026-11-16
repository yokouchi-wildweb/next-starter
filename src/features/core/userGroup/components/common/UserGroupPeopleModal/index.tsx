// src/features/core/userGroup/components/common/UserGroupPeopleModal/index.tsx
// 部品(props だけ、流れは hook useUserGroupPeople): 人の一覧のサブのモーダル(D93)。
// 名前の検索・無限スクロール(カーソル)・行ごとのチェック・「選んだ N 名を削除」(ConfirmPopover)・「全員を削除(計 N 名)」(Dialog、
// 検索に関係なく全部。検索を入れている間は押せない、D94)。グループのモーダルの上に重ねて開く

"use client";

import { useState } from "react";

import { Button } from "@/components/Form/Button";
import { BooleanCheckboxInput, Input } from "@/components/Form/Input/Manual";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import Modal from "@/components/Overlays/Modal";
import { Dialog } from "@/components/Overlays/Dialog";
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
  /** 全部の人数(「全員を削除(計 N 名)」。null = 分からない) */
  total?: number | null;
};

export function UserGroupPeopleModal({ title, people, emptyText, disabled = false, total = null }: UserGroupPeopleModalProps) {
  const { query } = people;
  const [clearOpen, setClearOpen] = useState(false);
  const totalText = total !== null ? `計 ${total.toLocaleString("ja-JP")} 名` : "全員";
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
              {items.map((person) => (
                <Flex key={person.id} align="center" gap="xs" className="border-b border-border py-1" data-slot="user-group-person">
                  {!disabled ? (
                    <BooleanCheckboxInput
                      value={people.isSelected(person.id)}
                      onChange={(on) => people.toggle(person.id, on === true)}
                      aria-label={`${person.name ?? "名前未設定のユーザー"}を選ぶ`}
                    />
                  ) : null}
                  <Span size="sm">{person.name ?? "名前未設定のユーザー"}</Span>
                </Flex>
              ))}
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
              variant="outline"
              className="border-destructive text-destructive-text"
              disabled={people.searching || people.busy || total === 0}
              onClick={() => setClearOpen(true)}
            >
              {`全員を削除(${totalText})`}
            </Button>
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
      <Dialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        layer="alert"
        overlayLayer="alert"
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
