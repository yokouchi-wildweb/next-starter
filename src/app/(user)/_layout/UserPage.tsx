// src/app/(user)/_layout/UserPage.tsx

import { Main, type MainProps } from "@/components/TextBlocks";
import { USER_PAGE_CONTAINER_TYPE } from "@/config/ui/user-layout.config";
import { cn } from "@/lib/cn";

import { HideBottomNav, HideFooter, HideHeader } from "@/components/AppFrames/User/controls";

export type UserPageProps = MainProps & {
  /**
   * ビューポート充填モード（opt-in、既定 false）。
   *
   * true にすると、固定ヘッダー直下からフッター/ボトムナビスペーサー直上までの
   * 残り高さちょうどにスナップし、ページ自体はスクロールしない土台になる。
   * 内部スクロールは子に委譲する（ゲーム・プレイヤー・エディタ・キオスク等の
   * 「アプリ的」な非スクロールページ向け）。
   *
   * 仕組み: UserLayout の外枠（[data-user-app-container]）は既定 min-h で伸びるが、
   * 配下に data-user-fill があると styles/config.css の :has() ルールで確定高さ +
   * overflow-clip に切り替わる。#stretch-wrapper は既に flex-1 min-h-0 flex-col
   * なので、ここに flex-1 min-h-0 を付けるだけで残り高さを占有する。
   * ResizeObserver も calc(100dvh - Nrem) のマジックナンバーも不要で、ヘッダー高さ・
   * フッター/ボトムナビの表示状態に自動追従する。
   *
   * 使い方: fill 配下の子は calc() を書かず `flex-1 min-h-0` だけで残り高さを
   * 確保できる（スクロールさせたい子は加えて overflow-y-auto）。
   * 余白は既定 none（端まで使う用途が主）。必要なら Main の padding props で上書き。
   *
   * false の時の出力は従来と完全に同一。
   */
  fill?: boolean;
  /**
   * 没入モード（opt-in、既定 false）。fill を含み、加えてヘッダー・フッター・
   * ボトムナビを SP/PC ともに非表示にする（HideHeader / HideFooter / HideBottomNav
   * を内部で描画）。ページ全体がビューポートちょうどになる。
   *
   * 「画面を奪うオーバーレイ」が欲しい場合は Main containerType="fullscreen"
   * （FullScreen による fixed オーバーレイ）を使う。immersive はフロー内に留まる
   * ページ土台であり、z 層や body スクロールロックを伴わない。
   *
   * Hide* は印（controls/frameParts.ts）なので SSR の HTML だけで隠れる
   * （初回描画でヘッダー等が見えることは無い）。
   */
  immersive?: boolean;
  /**
   * fill / immersive 時に env(safe-area-inset-*) ぶんのパディングを付与する
   * （横向きスマホのノッチ、ホームインジケータ等の回避）。fill でない時は無効。
   */
  safeArea?: boolean;
};

export function UserPage({
  children,
  fill = false,
  immersive = false,
  safeArea = false,
  className,
  padding,
  containerType,
  ...props
}: UserPageProps) {
  const isFill = fill || immersive;

  if (!isFill) {
    // 幅の既定は config/ui/user-layout.config の USER_PAGE_CONTAINER_TYPE(明示があればそちら)
    return (
      <Main className={className} padding={padding} containerType={containerType ?? USER_PAGE_CONTAINER_TYPE} {...props}>
        {children}
      </Main>
    );
  }

  return (
    <>
      {immersive && (
        <>
          <HideHeader />
          <HideFooter />
          <HideBottomNav />
        </>
      )}
      <Main
        data-user-fill=""
        containerType={containerType ?? "plain"}
        padding={padding ?? "none"}
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-clip overscroll-none",
          safeArea &&
            "pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]",
          className,
        )}
        {...props}
      >
        {children}
      </Main>
    </>
  );
}
