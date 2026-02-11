// src/features/core/userTag/components/common/UserTagList.tsx

"use client";

import { useMemo } from "react";
import type { UserTag } from "@/features/core/userTag/entities/model";
import { useUserTagList } from "@/features/core/userTag/hooks/useUserTagList";
import { getTagColorStyle } from "@/features/core/userTag/constants/colors";
import { SolidBadge, type SolidBadgeProps } from "@/components/Badge";
import { Stack, type StackSpace } from "@/components/Layout/Stack";
import { cn } from "@/lib/cn";

export type UserTagListProps = {
  /** 表示するタグIDの配列 */
  tagIds: string[] | null | undefined;
  /** バッジのサイズ */
  size?: SolidBadgeProps["size"];
  /** 並び方向（row: 横並び, column: 縦並び） */
  direction?: "row" | "column";
  /** 要素間のスペース */
  space?: StackSpace;
};

/**
 * ユーザータグをカラー付きバッジで表示するコンポーネント
 * タグIDを渡すと、内部でマスターデータをキャッシュ参照して色付き表示する
 */
export function UserTagList({
  tagIds,
  size = "sm",
  direction = "row",
  space = 1,
}: UserTagListProps) {
  const { data: allTags = [] } = useUserTagList({
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const displayTags = useMemo(() => {
    if (!tagIds || tagIds.length === 0) return [];
    const tagMap = new Map(allTags.map((t) => [t.id, t]));
    return tagIds
      .map((id) => tagMap.get(id))
      .filter((t): t is UserTag => t !== undefined);
  }, [tagIds, allTags]);

  if (displayTags.length === 0) return null;

  return (
    <Stack
      space={space}
      className={cn(direction === "row" && "flex-row flex-wrap")}
    >
      {displayTags.map((tag) => {
        const colorStyle = getTagColorStyle(tag.color);
        return (
          <SolidBadge
            key={tag.id}
            size={size}
            className={colorStyle ? cn(colorStyle.bg, colorStyle.text) : undefined}
            variant={colorStyle ? undefined : "muted"}
          >
            {tag.name}
          </SolidBadge>
        );
      })}
    </Stack>
  );
}
