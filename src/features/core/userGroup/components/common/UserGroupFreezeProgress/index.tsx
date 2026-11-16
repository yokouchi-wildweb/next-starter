// src/features/core/userGroup/components/common/UserGroupFreezeProgress/index.tsx
// 部品(props だけ): 固定のグループの一員を書く進み具合。書いている途中(送り直しの回・書いた人数)/ 書き終えた(人数・入らなかった人)/
// 失敗(理由)。送り直しは hook useUserGroupFreeze が自動でする

"use client";

import { Button } from "@/components/Form/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { Para } from "@/components/TextBlocks/Para";

import type { UserGroupFreezeProgress as Progress } from "@/features/core/userGroup/hooks/useUserGroupFreeze";

export type UserGroupFreezeProgressProps = {
  progress: Progress;
  onCancel?: () => void;
  onClear?: () => void;
};

export function UserGroupFreezeProgress({ progress, onCancel, onClear }: UserGroupFreezeProgressProps) {
  if (progress.status === "idle") return null;
  return (
    <Stack gap="xs" className="rounded-md border border-border bg-muted/30 p-4" data-slot="user-group-freeze">
      {progress.status === "running" ? (
        <Flex align="center" justify="between" gap="xs" wrap="wrap">
          <Flex align="center" gap="xs">
            <Spinner className="size-4" />
            <Para size="sm" className="my-0">
              {progress.rounds === 0
                ? "固定グループを作成しています…"
                : `メンバーを登録しています(${progress.staged.toLocaleString("ja-JP")} 人まで登録済み)…`}
            </Para>
          </Flex>
          {onCancel ? (
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              中止
            </Button>
          ) : null}
        </Flex>
      ) : null}
      {progress.status === "done" ? (
        <Flex align="center" justify="between" gap="xs" wrap="wrap">
          <Para size="sm" className="my-0">
            {`「${progress.group.name}」に ${progress.memberCount.toLocaleString("ja-JP")} 人を登録しました${
              progress.skipped > 0 ? `(${progress.skipped.toLocaleString("ja-JP")} 人は登録できませんでした)` : ""
            }`}
          </Para>
          {onClear ? (
            <Button type="button" size="sm" variant="ghost" onClick={onClear}>
              閉じる
            </Button>
          ) : null}
        </Flex>
      ) : null}
      {progress.status === "failed" ? (
        <Para size="sm" tone="destructive" className="my-0">
          {progress.group ? `「${progress.group.name}」のメンバーを登録できませんでした: ${progress.reason}` : progress.reason}
        </Para>
      ) : null}
    </Stack>
  );
}
