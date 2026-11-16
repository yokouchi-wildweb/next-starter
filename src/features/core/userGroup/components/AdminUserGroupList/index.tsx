// src/features/core/userGroup/components/AdminUserGroupList/index.tsx
// セクションコンテナ(管理: ユーザーグループの一覧)。種類・状態で絞る + 無限スクロール(カーソル)。
// 行 = 名前・種類・人数(数えた / 見込み / 数えていない / まだ無い)・定期計算の最後の時刻と失敗(UserGroupRow)。例外の持ち主つきのグループはサーバーが出さない。
// アーカイブしたものは状態で「アーカイブ」を選んだ時だけ。行を押すと直すモーダル、上の「新規作成」で作るモーダル(AdminUserGroupModal)。
// 行の右の操作(アーカイブする・アクティブに戻す・削除、D92)は hook の rowActions。流れは hook useAdminUserGroupList。下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { Button } from "@/components/Form/Button";
import { SelectInput } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";

import { AdminUserGroupModal } from "@/features/core/userGroup/components/AdminUserGroupModal";
import { UserGroupRow } from "@/features/core/userGroup/components/common/UserGroupRow";
import { useAdminUserGroupList, type UserGroupStatusFilter } from "@/features/core/userGroup/hooks/useAdminUserGroupList";

const OBSERVER_OPTIONS: IntersectionObserverInit = { rootMargin: "0px 0px 160px 0px", threshold: 0.1 };
const KIND_OPTIONS = [
  { value: "dynamic", label: "条件で自動" },
  { value: "scheduled", label: "定期的に更新" },
  { value: "static", label: "手動で指定" },
];
// すべて = 使用中とアーカイブの両方(既定、D87)。値は all(空の値は Radix の SelectItem が受けない)
const STATUS_OPTIONS = [
  { value: "all", label: "すべて" },
  { value: "active", label: "使用中" },
  { value: "archived", label: "アーカイブ" },
];

export function AdminUserGroupList() {
  const { kind, setKind, status, setStatus, query, modal, rowActions } = useAdminUserGroupList({ observerOptions: OBSERVER_OPTIONS });

  return (
    <Stack space={4}>
      <Flex align="end" justify="between" gap="sm" wrap="wrap">
        <Flex align="end" gap="sm" wrap="wrap">
          <Stack space={1}>
            <Label htmlFor="user-group-filter-kind" className="text-xs">
              種類
            </Label>
            <SelectInput
              id="user-group-filter-kind"
              value={kind}
              onChange={(v) => setKind(v ? String(v) : "")}
              options={KIND_OPTIONS}
              placeholder="すべて"
              includeNullOption
              nullOptionLabel="すべて"
            />
          </Stack>
          <Stack space={1}>
            <Label htmlFor="user-group-filter-status" className="text-xs">
              状態
            </Label>
            <SelectInput id="user-group-filter-status" value={status} onChange={(v) => setStatus((v ? String(v) : "all") as UserGroupStatusFilter)} options={STATUS_OPTIONS} showPlaceholderOption={false} />
          </Stack>
        </Flex>
        <Button type="button" size="sm" variant="primary" onClick={modal.openNew}>
          新規作成
        </Button>
      </Flex>
      <InfiniteScrollList
        items={query.items}
        isInitialLoading={query.isInitialLoading}
        isFetchingMore={query.isFetchingMore}
        hasMore={query.hasMore}
        error={query.error}
        sentinelRef={query.sentinelRef}
        onRetry={query.retry}
        emptyNode={
          <Para tone="muted" align="center">
            {status === "archived" ? "アーカイブしたグループはありません" : "ユーザーグループはありません"}
          </Para>
        }
        completedText="すべて表示しました"
      >
        {(items) => (
          <Stack space={2}>
            {items.map((group) => (
              <UserGroupRow
                key={group.id}
                group={group}
                onOpen={() => modal.openGroup(group.id)}
                onArchive={() => rowActions.archive(group.id)}
                onRestore={() => rowActions.restore(group.id)}
                onDelete={() => rowActions.remove(group.id)}
              />
            ))}
          </Stack>
        )}
      </InfiniteScrollList>
      <AdminUserGroupModal open={modal.open} onOpenChange={modal.setOpen} groupId={modal.groupId} onChanged={modal.onChanged} />
    </Stack>
  );
}
