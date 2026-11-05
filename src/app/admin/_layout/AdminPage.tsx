// src/app/admin/_layout/AdminPage.tsx

import type { PropsWithChildren, ReactNode } from "react";

import { Main } from "@/components/TextBlocks";

import { AdminPageHeader } from "./AdminHeaderContext";

export type AdminPageProps = PropsWithChildren<{
  /** ヘッダーの行の題の位置(ロゴの右隣、sm 以上)に描く物。省略 = 空(今は PageTitle placement="header" の差し込みがここに着地する) */
  title?: ReactNode;
  /** ヘッダーの行の中央に描く物(タブ・検索など) */
  center?: ReactNode;
  /** ヘッダーの行の右(明暗の切り替えの前)に描く操作 */
  actions?: ReactNode;
  /** 本文の前に描くタブ(下に余白 mb-6)。省略 = 無し */
  tabs?: ReactNode;
  /**
   * 本文を AdminPage の Main(padding lg / paddingBlock xl)で包むか。既定 true。
   * false = ヘッダーの行だけを描き、children はそのまま続ける(自分のスクロール領域と Main を持つ login・setup だけが使う)
   */
  main?: boolean;
}>;

/**
 * 管理画面のページコンテナ。ヘッダーの行(./AdminHeader の部品: ロゴ + title / center / actions + 明暗の切り替え)もここで描く。
 * 行は利用者の枠のヘッダーと同じく上端に固定(全幅)で、高さは AdminLayout の器が上の余白(--app-header-height)で空ける。
 * AdminLayout の header の prop で fork がヘッダーを差し替えている間は行を描かない(./AdminHeaderContext、指令 16 までの橋)。
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
export default function AdminPage({ title, center, actions, tabs, children, main = true }: AdminPageProps) {
  return (
    <>
      <AdminPageHeader title={title} center={center} actions={actions} />
      {main ? (
        <Main containerType="plain" padding="lg" paddingBlock="xl">
          {tabs && <div className="mb-6">{tabs}</div>}
          {children}
        </Main>
      ) : (
        <>
          {tabs && <div className="mb-6">{tabs}</div>}
          {children}
        </>
      )}
    </>
  );
}
