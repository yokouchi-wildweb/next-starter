// src/app/(user)/_layout/UserPage.tsx

import { Main, type MainProps } from "@/components/TextBlocks";
import { userLayoutConfig } from "./config";
import { cn } from "@/lib/cn";

export type UserPageProps = MainProps & {
  /**
   * 端末の切り欠き(--app-safe-area-*)ぶんのパディングを付与する（横向きスマホのノッチ、ホームインジケータ等の回避）。
   * 枠の部位(ヘッダー・フッター・ボトムナビ)を枠の宣言で隠したページ用。枠の部位が出ている辺は枠が避けるので、
   * 部位を出したまま付けると二重に避ける(例: ボトムナビのスペーサーと本文の下の余白)
   */
  safeArea?: boolean;
};

/**
 * ユーザー側のページコンテナ。枠の部位の出し入れと「本文が画面の高さを埋める」は、
 * ページの隣の枠の宣言(上流 frame.default.ts / 下のリポ frame.ts)に書く(仕組み: src/app/_layout/frame/README.md)。
 * 高さを埋めるページの本文は `flex-1 min-h-0`(とスクロールさせない `overflow-clip`)を自分で付ける
 */
export function UserPage({ children, safeArea = false, className, padding, containerType, ...props }: UserPageProps) {
  // 幅の既定は枠の設定 layout.pageContainerType(./config.ts、明示があればそちら)
  return (
    <Main
      className={
        safeArea
          ? cn(
              "pt-[var(--app-safe-area-top)] pr-[var(--app-safe-area-right)] pb-[var(--app-safe-area-bottom)] pl-[var(--app-safe-area-left)]",
              className,
            )
          : className
      }
      padding={padding}
      containerType={containerType ?? userLayoutConfig.layout.pageContainerType}
      {...props}
    >
      {children}
    </Main>
  );
}
