// src/features/core/userGroup/components/common/UserGroupRow/index.tsx
// 部品(props だけ): 一覧の 1 行。名前・種類の表示名・人数(数えた / 見込み / 数えていない / まだ無い)・保管・定期計算の様子(人数の右に括弧で)。
// 押すと onOpen(直すモーダル)。内部の鍵・id は出さない(D94)。
// 行の右の操作(D92、渡した物だけ): アーカイブする(使用中)/ アクティブに戻す(アーカイブ済み)・削除。どれも ConfirmPopover。
// 行に乗る・行の中に入る(focus-within)と出る。触る画面(hover: none)と狭い幅ではいつも出す。操作は行の開くボタンの外(押してもモーダルは開かない)。
// 削除できない(deletable false)時は押せず、理由(サーバーの文 deleteReasons)を Tooltip で出す

import { Button } from "@/components/Button/Button";
import { ConfirmPopover } from "@/components/Overlays/Popover";
import { Tooltip } from "@/components/Overlays/Tooltip";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks/Span";

import { UserGroupRecomputeStatus } from "@/features/core/userGroup/components/common/UserGroupRecomputeStatus";
import type { AdminUserGroupCount, AdminUserGroupSummary } from "@/features/core/userGroup/services/client/userGroupAdminClient";

export type UserGroupRowProps = {
  group: AdminUserGroupSummary;
  onOpen: () => void;
  /** アーカイブする(使用中の行。無ければ出さない) */
  onArchive?: () => Promise<void>;
  /** アクティブに戻す(アーカイブ済みの行。無ければ出さない) */
  onRestore?: () => Promise<void>;
  /** 削除(無ければ出さない) */
  onDelete?: () => Promise<void>;
};

// 乗る・入ると出す。触る画面と狭い幅ではいつも出す
const ACTIONS_VISIBILITY =
  "opacity-100 md:opacity-0 md:group-hover/user-group-row:opacity-100 md:group-focus-within/user-group-row:opacity-100 [@media(hover:none)]:opacity-100";

/** 人数の表示 */
export function userGroupCountText(count: AdminUserGroupCount): string {
  if (count.state === "counted") return `${(count.value ?? 0).toLocaleString("ja-JP")} 人`;
  if (count.state === "estimated") return `約 ${(count.value ?? 0).toLocaleString("ja-JP")} 人(見積もり)`;
  if (count.state === "not_computed") return "人数は未計算です(条件が重いか、時間内に数えきれませんでした)";
  return "まだ集計されていません";
}

export function UserGroupRow({ group, onOpen, onArchive, onRestore, onDelete }: UserGroupRowProps) {
  const archived = group.status === "archived";
  const hasActions = Boolean((archived ? onRestore : onArchive) || onDelete);
  return (
    <Flex align="stretch" gap="xs" wrap="wrap" className="group/user-group-row rounded-md border border-border bg-card hover:bg-muted/40" data-slot="user-group-row">
      <Button
        type="button"
        variant="none"
        onClick={onOpen}
        className="block h-auto min-w-0 flex-1 whitespace-normal px-4 py-3 text-left"
      >
        <Stack gap="2xs">
          <Flex align="center" gap="xs" wrap="wrap">
            <Span weight="semiBold">{group.name}</Span>
            {archived ? (
              <Span size="sm" tone="muted">
                {`(${group.statusLabel})`}
              </Span>
            ) : null}
          </Flex>
          <Flex gap="md" wrap="wrap">
            <Span size="sm" tone="muted">
              {group.kindLabel}
            </Span>
            <Flex align="center" gap="xs" wrap="wrap">
              {group.count.state === "estimated" ? (
                <>
                  <Span size="sm" data-slot="user-group-count">
                    {`約 ${(group.count.value ?? 0).toLocaleString("ja-JP")} 人`}
                  </Span>
                  <Span size="sm" tone="muted">
                    (見積もり)
                  </Span>
                </>
              ) : (
                <Span size="sm" data-slot="user-group-count">
                  {userGroupCountText(group.count)}
                </Span>
              )}
              {group.recompute ? <UserGroupRecomputeStatus recompute={group.recompute} inline /> : null}
            </Flex>
          </Flex>
        </Stack>
      </Button>
      {hasActions ? (
        <Flex align="center" gap="xs" className={`px-3 py-2 transition-opacity ${ACTIONS_VISIBILITY}`} data-slot="user-group-row-actions">
          {!archived && onArchive ? (
            <ConfirmPopover
              trigger={
                <Button type="button" size="sm" variant="outline">
                  アーカイブする
                </Button>
              }
              title="アーカイブする"
              description={`「${group.name}」をアーカイブします。送信の宛先やほかのグループの条件で選べなくなります(あとで戻せます)。`}
              confirmLabel="アーカイブする"
              onConfirm={onArchive}
            />
          ) : null}
          {archived && onRestore ? (
            <ConfirmPopover
              trigger={
                <Button type="button" size="sm" variant="outline">
                  アクティブに戻す
                </Button>
              }
              title="アクティブに戻す"
              description={`「${group.name}」を使用中に戻します。`}
              confirmLabel="戻す"
              onConfirm={onRestore}
            />
          ) : null}
          {onDelete ? (
            group.deletable ? (
              <ConfirmPopover
                trigger={
                  <Button type="button" size="sm" variant="destructiveGhost">
                    削除
                  </Button>
                }
                title="グループを削除"
                description={`「${group.name}」を削除します。条件・一員・例外の人も消え、元に戻せません。`}
                confirmLabel="削除する"
                confirmVariant="destructive"
                onConfirm={onDelete}
              />
            ) : (
              <Tooltip
                content={
                  <Stack gap="2xs">
                    {group.deleteReasons.map((reason) => (
                      <Span key={reason} size="xs" tone="inherit">
                        {reason}
                      </Span>
                    ))}
                    <Span size="xs" tone="inherit">
                      削除できない間はアーカイブしてください
                    </Span>
                  </Stack>
                }
              >
                <Span tabIndex={0} className="inline-flex" aria-label="削除できません">
                  <Button type="button" size="sm" variant="ghost" disabled>
                    削除
                  </Button>
                </Span>
              </Tooltip>
            )
          ) : null}
        </Flex>
      ) : null}
    </Flex>
  );
}
