// src/app/(user)/_layout/UserPage.tsx

import { Main, type MainProps } from "@/components/TextBlocks";
import { USER_PAGE_CONTAINER_TYPE } from "@/config/ui/user-layout.config";
import { cn } from "@/lib/cn";

export type UserPageProps = MainProps & {
  /**
   * env(safe-area-inset-*) ぶんのパディングを付与する（横向きスマホのノッチ、ホームインジケータ等の回避）。
   * 本文が画面の高さを埋めるページ(ルートの frame.ts で宣言)で使う想定
   */
  safeArea?: boolean;
};

/**
 * ユーザー側のページコンテナ。枠の部位の出し入れと「本文が画面の高さを埋める」は、
 * ページの隣の frame.ts で宣言する(仕組み: src/app/_layout/frame/README.md)。
 * 高さを埋めるページの本文は `flex-1 min-h-0`(とスクロールさせない `overflow-clip`)を自分で付ける
 */
export function UserPage({ children, safeArea = false, className, padding, containerType, ...props }: UserPageProps) {
  // 幅の既定は config/ui/user-layout.config の USER_PAGE_CONTAINER_TYPE(明示があればそちら)
  return (
    <Main
      className={
        safeArea
          ? cn(
              "pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]",
              className,
            )
          : className
      }
      padding={padding}
      containerType={containerType ?? USER_PAGE_CONTAINER_TYPE}
      {...props}
    >
      {children}
    </Main>
  );
}
