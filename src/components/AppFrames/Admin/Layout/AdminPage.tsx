// src/components/Admin/Layout/AdminPage.tsx

import type { PropsWithChildren } from "react";

import { Main } from "@/components/TextBlocks";

export type AdminPageProps = PropsWithChildren<{
  /**
   * ビューポート充填モード（opt-in、既定 false）。
   *
   * true にすると、固定ヘッダー直下に残る高さちょうどにスナップし、
   * ページ自体はスクロールしない土台になる。内部スクロールは子に委譲する。
   *
   * 仕組み: AdminOuterLayout の子領域は既に `flex flex-col`（h-[100dvh] の
   * ヘッダー下 flex-1 min-h-0 overflow-clip 領域）なので、ここに
   * `flex-1 min-h-0` を付けるだけで残り高さを占有する。ResizeObserver も
   * calc(100dvh - Nrem) のマジックナンバーも不要で、ヘッダー密度や画面内
   * ツールバーの変化に自動追従する。
   *
   * 使い方: fill 配下の子は calc() を書かず、`h-full min-h-0 overflow-y-auto`
   * だけでスクロール領域を確保できる。ページ余白は
   * --admin-page-padding-inline / --admin-page-padding-block トークン経由で
   * 付与されるため、子は余白を差し引く計算を持たなくてよい。
   *
   * どうしても子側で calc() が必要な特殊配置では、マジックナンバーの代わりに
   * トークンを使う:
   *   calc(100dvh - var(--app-header-height) - var(--admin-page-padding-block) * 2)
   */
  fill?: boolean;
}>;

export default function AdminPage({ children, fill = false }: AdminPageProps) {
  if (fill) {
    return (
      <Main
        data-admin-fill=""
        containerType="plain"
        padding="none"
        paddingBlock="none"
        className="flex min-h-0 flex-1 flex-col px-[var(--admin-page-padding-inline)] py-[var(--admin-page-padding-block)]"
      >
        {children}
      </Main>
    );
  }

  return (
    <Main containerType="plain" padding="lg" paddingBlock="xl">
      {children}
    </Main>
  );
}
