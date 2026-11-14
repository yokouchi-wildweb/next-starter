// src/features/core/userGroup/components/common/UserGroupRow/index.tsx
// 部品(props だけ): 一覧の 1 行。名前・種類の表示名・人数(数えた / 見込み / 数えていない / まだ無い)・保管・定期計算の様子。
// 押すと onOpen(直すモーダル)。内部の鍵・id は出さない(D94)

import { Button } from "@/components/Form/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks/Span";

import { UserGroupRecomputeStatus } from "@/features/core/userGroup/components/common/UserGroupRecomputeStatus";
import type { AdminUserGroupCount, AdminUserGroupSummary } from "@/features/core/userGroup/services/client/userGroupAdminClient";

export type UserGroupRowProps = {
  group: AdminUserGroupSummary;
  onOpen: () => void;
};

/** 人数の表示 */
export function userGroupCountText(count: AdminUserGroupCount): string {
  if (count.state === "counted") return `${(count.value ?? 0).toLocaleString("ja-JP")} 人`;
  if (count.state === "estimated") return `約 ${(count.value ?? 0).toLocaleString("ja-JP")} 人(今数えた見込み)`;
  if (count.state === "not_computed") return "人数は数えていません(条件が重いか、時間の上限)";
  return "人数はまだありません(計算の前)";
}

export function UserGroupRow({ group, onOpen }: UserGroupRowProps) {
  return (
    <Button
      type="button"
      variant="none"
      onClick={onOpen}
      className="block h-auto w-full whitespace-normal rounded-md border border-border bg-card px-4 py-3 text-left hover:bg-muted/40"
      data-slot="user-group-row"
    >
      <Stack space={1}>
        <Flex align="center" gap="xs" wrap="wrap">
          <Span weight="semiBold">{group.name}</Span>
          {group.status === "archived" ? (
            <Span size="sm" tone="muted">
              {`(${group.statusLabel})`}
            </Span>
          ) : null}
        </Flex>
        <Flex gap="sm" wrap="wrap">
          <Span size="sm" tone="muted">
            {group.kindLabel}
          </Span>
          <Span size="sm" data-slot="user-group-count">
            {userGroupCountText(group.count)}
          </Span>
        </Flex>
        {group.recompute ? <UserGroupRecomputeStatus recompute={group.recompute} /> : null}
      </Stack>
    </Button>
  );
}
