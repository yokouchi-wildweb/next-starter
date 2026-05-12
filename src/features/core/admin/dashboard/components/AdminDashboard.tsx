// src/features/core/admin/dashboard/components/AdminDashboard.tsx

import { adminDashboardSections } from "../registry";

/**
 * 管理ダッシュボード本体。
 *
 * `registry.ts` に登録されたセクションを順に描画するだけのシンコンポーネント。
 *
 * - 各セクションは Server Component (async) でも可。React がそれぞれ並列に解決する
 * - セクションの追加・削除・並べ替えは全て `registry.ts` で完結する
 * - 本ファイルはセクションの存在を一切知らないため、セクション増減でも変更不要
 */
export function AdminDashboard() {
  return (
    <>
      {adminDashboardSections.map(({ id, Component }) => (
        <Component key={id} />
      ))}
    </>
  );
}
