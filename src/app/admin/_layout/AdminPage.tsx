// src/app/admin/_layout/AdminPage.tsx

import type { PropsWithChildren, ReactNode } from "react";

import { Main } from "@/components/TextBlocks";

export type AdminPageProps = PropsWithChildren<{
  /** 本文の前に描くタブ(下に余白 mb-6)。省略 = 無し */
  tabs?: ReactNode;
}>;

/**
 * 管理画面のページコンテナ。
 *
 * 本文を固定ヘッダー直下の残り高さちょうどにする(ページ自体はスクロールせず、内部スクロールは子に委譲する)ときは、
 * ページの隣の枠の宣言(上流 frame.default.ts の frameDefault / 下のリポ frame.ts の frame)に
 * `page: { fill: true }`(その下全部なら `layout: { fill: true }`)を書く。外枠の data-frame-fill を
 * src/styles/core/frame.css が読み、この Main(#main)を flex-1 min-h-0 の flex-col にし、余白を
 * --admin-page-padding-inline / --admin-page-padding-block トークンに替える(仕組み: src/app/_layout/frame/README.md)。
 *
 * fill 配下の子は calc() を書かず、`h-full min-h-0 overflow-y-auto` だけでスクロール領域を確保できる。
 * どうしても子側で calc() が必要な特殊配置では、マジックナンバーの代わりにトークンを使う:
 *   calc(100dvh - var(--app-header-height) - var(--admin-page-padding-block) * 2)
 */
export default function AdminPage({ tabs, children }: AdminPageProps) {
  return (
    <Main containerType="plain" padding="lg" paddingBlock="xl">
      {tabs && <div className="mb-6">{tabs}</div>}
      {children}
    </Main>
  );
}
