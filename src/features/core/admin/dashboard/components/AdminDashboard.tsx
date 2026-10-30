// src/features/core/admin/dashboard/components/AdminDashboard.tsx

import { adminDashboardSections } from "../registry";
import type { AdminDashboardData } from "../types";

type AdminDashboardProps = {
  /** セクション id → load の結果(AdminHome の loader が services/server/sectionLoads.ts の取得を実行して渡す) */
  data: AdminDashboardData;
};

/**
 * 管理ダッシュボード本体。
 *
 * `registry.ts` に登録されたセクションを順に描画し、同じ id の取得結果を data で渡すだけのシンコンポーネント。
 *
 * - セクションの追加・削除・並べ替えは全て `registry.ts`(と取得は `services/server/sectionLoads.ts`)で完結する
 * - 本ファイルはセクションの存在を一切知らないため、セクション増減でも変更不要
 */
export function AdminDashboard({ data }: AdminDashboardProps) {
  return (
    <>
      {adminDashboardSections.map(({ id, Component }) => (
        <Component key={id} data={data[id]} />
      ))}
    </>
  );
}
